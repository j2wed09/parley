/** What the Rust side returns after shelling out to `claude -p`. The API key
 *  never appears here; Claude Code uses the login already on this Mac. */
export interface ClaudeRun {
  notFound: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ClaudeFailureCode = "claude-missing" | "claude-login" | "claude-failed" | "claude-empty" | "claude-unreadable";

export type ClaudeRead =
  | { ok: true; items: string[] }
  | { ok: false; code: ClaudeFailureCode; detail: string };

const LOGIN_HINT = /not logged in|\/login|not authenticated|unauthorized|please run [`']?claude|sign in to claude|claude auth/i;

/**
 * The prompt handed to Claude Code on stdin. The model is asked for a JSON
 * array and nothing else; {@link interpretClaudeRun} parses that array back out.
 */
export function claudeChecklistPrompt(notes: string): string {
  return [
    "Turn the notes below into a meeting checklist.",
    "",
    "Rules:",
    "- Each item is one short line the speaker can glance at, under 12 words.",
    "- Items are distinct. Merge duplicates. Drop greetings and meta notes that are not something to cover.",
    "- Keep the language of the notes. Do not translate.",
    "- Reply with ONLY a JSON array of strings. No markdown.",
    "",
    "Notes:",
    notes.trim(),
  ].join("\n");
}

/** Turn Claude Code's JSON stdout into checklist lines, or a failure the UI can translate. */
export function interpretClaudeRun(run: ClaudeRun): ClaudeRead {
  if (run.notFound) {
    return {
      ok: false,
      code: "claude-missing",
      detail: run.stderr.trim(),
    };
  }
  const stderr = run.stderr.trim();
  const stdout = run.stdout.trim();
  const blob = `${stderr}\n${stdout}`;
  if (run.exitCode !== 0) {
    return {
      ok: false,
      code: LOGIN_HINT.test(blob) ? "claude-login" : "claude-failed",
      detail: clip(stderr || stdout),
    };
  }
  if (LOGIN_HINT.test(blob) && !stdout) {
    return { ok: false, code: "claude-login", detail: clip(stderr) };
  }
  try {
    const items = itemsFromStdout(stdout);
    if (items.length === 0) return { ok: false, code: "claude-empty", detail: "" };
    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      code: "claude-unreadable",
      detail: clip(error instanceof Error ? error.message : stdout),
    };
  }
}

function itemsFromStdout(stdout: string): string[] {
  if (!stdout) throw new Error("Claude returned no output.");
  const payload = resultText(stdout);
  return itemsFromModelText(payload);
}

/** Claude `--output-format json` wraps the reply in `{ result, is_error }`.
 *  Some versions print one JSON object; stream-json prints one object per line.
 *  Take the last object that carries `result`. A bare JSON array is accepted too. */
function resultText(stdout: string): string {
  const direct = parseJson(stdout);
  const fromDirect = textFromPayload(direct);
  if (fromDirect != null) return fromDirect;

  let last: unknown = null;
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
    const parsed = parseJson(trimmed);
    if (parsed != null) last = parsed;
  }
  const fromLine = textFromPayload(last);
  if (fromLine != null) return fromLine;
  throw new Error(clip(stdout));
}

function textFromPayload(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return JSON.stringify(payload);
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { is_error?: unknown; result?: unknown; error?: unknown };
  if (record.is_error === true) {
    const message = typeof record.result === "string" ? record.result : "Claude reported an error.";
    throw new Error(message);
  }
  if (typeof record.result === "string") return record.result;
  if (Array.isArray(record.result)) return JSON.stringify(record.result);
  return null;
}

export function itemsFromModelText(text: string): string[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  const parsed = parseJson(candidate) ?? parseJson(sliceArray(candidate));
  if (!Array.isArray(parsed)) throw new Error(clip(trimmed));
  return normalizeItems(parsed);
}

export function normalizeItems(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of raw) {
    const text = itemText(entry);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text);
  }
  return items;
}

function itemText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (!entry || typeof entry !== "object" || !("text" in entry)) return "";
  const text = entry.text;
  return typeof text === "string" ? text.trim() : "";
}

function sliceArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}
