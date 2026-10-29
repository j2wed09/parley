import type { TodoItem } from "../types";

/** Pinned version. `jev-latest` moves when TypeSafe ships a release, and the
 *  done/partial thresholds were tuned on this one. Settings can override it. */
export const JEV_MODEL = "jev-1.14.0";

/** Jev scores one question against the state. Every checklist item uses this
 *  same yes-polarity wording; only the item text changes. Jev is sensitive to
 *  wording, so the template stays identical across items and releases. */
export const JEV_QUESTION_PREFIX = "Has this agenda item already been covered in the conversation?";

const PER_QUESTION_TOKENS = 32_000;
const PER_REQUEST_TOKENS = 64_000;
const CHARS_PER_TOKEN = 4;
/** Subtracted before the char estimate. Four characters per token runs close
 *  to the real count, so a few hundred tokens of spare is not enough: a full
 *  budget was landing about 1.8k tokens under the 32k per-question limit. */
export const TOKEN_HEADROOM = 8_000;

export interface JevNoulQuestion {
  type: "noul";
  instructions: string;
}

export interface JevRequest {
  model: string;
  state: string;
  questions: Record<string, JevNoulQuestion>;
}

export interface JevStateInput {
  title?: string;
  context?: string;
  transcript: string;
  items: Pick<TodoItem, "id" | "text">[];
}

export interface JevRequestOptions {
  /** Overrides {@link JEV_MODEL}. Blank falls back to the pin. */
  model?: string;
  /** Char cap for the whole `state`, including the header. The retry after a
   *  token-limit 400 passes a smaller cap than {@link maxStateChars}. */
  stateChars?: number;
}

/** The question sent for one checklist item. Same shape every time. */
export function jevInstructions(item: string): string {
  const safe = item.replace(/"/g, "'").replace(/\n/g, " ").trim();
  return (
    `${JEV_QUESTION_PREFIX} The agenda item is: "${safe}". ` +
    "Answer yes only if the transcript shows it was actually discussed or resolved, " +
    "not if it was merely mentioned or is still coming up."
  );
}

export function jevModelId(configured?: string): string {
  const trimmed = configured?.trim();
  return trimmed || JEV_MODEL;
}

/**
 * One System One request: the meeting so far as `state`, one noul question
 * per still-open item. Returns null when there is nothing to score (no items,
 * or no transcript). Trims the oldest transcript lines so the state stays
 * inside Jev's 32k-tokens-per-question and 64k-tokens-per-request limits,
 * with {@link TOKEN_HEADROOM} held back from the 4-chars-per-token estimate.
 */
export function buildJevRequest(input: JevStateInput, options?: JevRequestOptions): JevRequest | null {
  const items = input.items.filter((item) => item.id && item.text.trim());
  const transcript = input.transcript.trim();
  if (items.length === 0 || !transcript) return null;

  const questions: Record<string, JevNoulQuestion> = {};
  for (const item of items) {
    questions[item.id] = { type: "noul", instructions: jevInstructions(item.text) };
  }

  const header = stateHeader(input.title ?? "", input.context ?? "");
  const cap = options?.stateChars ?? maxStateChars(Object.values(questions));
  const budget = cap - header.length;
  const body = trimTranscript(transcript, Math.max(0, budget));
  return { model: jevModelId(options?.model), state: `${header}${body}`, questions };
}

/** A 400 whose body says the request did not fit Jev's context window. */
export function isJevTokenLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b400\b/.test(message) && /max_tokens_exceeded/i.test(message);
}

/** Pull `answers[<id>].noul` out of a System One response. */
export function readingsFromJevResponse(body: unknown): { id: string; probability: number }[] {
  if (!body || typeof body !== "object" || !("answers" in body)) {
    throw new Error("TypeSafe returned a response without answers.");
  }
  const answers = (body as { answers: unknown }).answers;
  if (!answers || typeof answers !== "object") {
    throw new Error("TypeSafe returned a response without answers.");
  }
  const readings: { id: string; probability: number }[] = [];
  for (const [id, answer] of Object.entries(answers)) {
    if (!answer || typeof answer !== "object" || !("noul" in answer)) continue;
    const noul = (answer as { noul: unknown }).noul;
    if (typeof noul !== "number" || !Number.isFinite(noul)) continue;
    readings.push({ id, probability: Math.min(1, Math.max(0, noul)) });
  }
  return readings;
}

function stateHeader(title: string, context: string): string {
  const parts: string[] = [];
  if (title.trim()) parts.push(`Meeting: ${title.trim()}`);
  if (context.trim()) parts.push(context.trim());
  parts.push("Transcript:");
  return `${parts.join("\n\n")}\n`;
}

/** Char budget for `state`, given the questions that ride along with it.
 *  {@link TOKEN_HEADROOM} is held back on both the per-question and the
 *  per-request limit before the 4-chars-per-token estimate is applied. */
export function maxStateChars(questions: readonly { instructions: string }[]): number {
  const questionTokens = questions.map((q) => Math.ceil((q.instructions.length + 48) / CHARS_PER_TOKEN));
  const largest = Math.max(...questionTokens, 1);
  const sum = questionTokens.reduce((total, n) => total + n, 0);
  const perQuestion = PER_QUESTION_TOKENS - largest - TOKEN_HEADROOM;
  const perRequest = PER_REQUEST_TOKENS - sum - TOKEN_HEADROOM;
  return Math.max(1_000, Math.min(perQuestion, perRequest)) * CHARS_PER_TOKEN;
}

/** Drop whole lines from the start until `text` fits. The newest speech stays.
 *  The omission line is counted against the same budget, so the result is
 *  never longer than `budgetChars`. */
export function trimTranscript(text: string, budgetChars: number): string {
  if (budgetChars <= 0) return "";
  if (text.length <= budgetChars) return text;
  const lines = text.split("\n");
  const kept: string[] = [];
  let used = 0;
  // Leave room for the "earlier transcript omitted" line on large cuts.
  // A tiny budget keeps the newest text instead of spending it on the notice.
  const reserve = budgetChars > 200 ? 80 : 0;
  const lineBudget = Math.max(1, budgetChars - reserve);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const cost = line.length + 1;
    if (kept.length > 0 && used + cost > lineBudget) break;
    if (kept.length === 0 && line.length > lineBudget) {
      kept.push(line.slice(line.length - lineBudget));
      break;
    }
    kept.push(line);
    used += cost;
  }
  kept.reverse();
  const omitted = lines.length - kept.length;
  const body = kept.join("\n");
  if (omitted <= 0) return body.length <= budgetChars ? body : body.slice(body.length - budgetChars);
  const prefix = `[Earlier transcript omitted, ${omitted} lines]\n`;
  if (prefix.length >= budgetChars) return body.slice(Math.max(0, body.length - budgetChars));
  const room = budgetChars - prefix.length;
  const fitted = body.length <= room ? body : body.slice(body.length - room);
  return prefix + fitted;
}
