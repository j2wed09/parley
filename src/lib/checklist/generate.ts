import { z } from "zod";
import { JSON_MODE_INSTRUCTION } from "../ai/provider";
import { generateObjectResilient } from "../ai/generate";
import { hasProviderKey } from "../ai/settings";
import { recordLlmUsage } from "../usage/log";
import { useStore } from "../store";
import * as ipc from "../ipc/commands";
import { claudeChecklistPrompt, interpretClaudeRun, normalizeItems } from "./claude";

export type ChecklistGenerateErrorCode =
  | "no-notes"
  | "claude-missing"
  | "claude-login"
  | "claude-failed"
  | "claude-empty"
  | "claude-unreadable"
  | "provider-missing"
  | "provider-failed";

export class ChecklistGenerateError extends Error {
  readonly code: ChecklistGenerateErrorCode;
  readonly detail: string;

  constructor(code: ChecklistGenerateErrorCode, detail = "") {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

const schema = z.object({
  items: z.array(z.string()).describe("Short, distinct checklist lines, in the language of the notes."),
});

/**
 * Turn a free-form brain dump into checklist lines.
 *
 * The default path shells out to the Claude Code CLI (`claude -p`, JSON
 * output) so it uses the login already on this Mac. Settings can switch the
 * same job to the configured LLM provider.
 */
export async function generateChecklist(notes: string): Promise<string[]> {
  const trimmed = notes.trim();
  if (!trimmed) throw new ChecklistGenerateError("no-notes");
  const { settings } = useStore.getState();
  if (settings.checklistGenerator === "provider") return generateWithProvider(trimmed);
  return generateWithClaude(trimmed);
}

async function generateWithClaude(notes: string): Promise<string[]> {
  const run = await ipc.runClaude({ prompt: claudeChecklistPrompt(notes) });
  const read = interpretClaudeRun(run);
  if (!read.ok) throw new ChecklistGenerateError(read.code, read.detail);
  return read.items;
}

async function generateWithProvider(notes: string): Promise<string[]> {
  const { settings } = useStore.getState();
  if (!hasProviderKey(settings, "deep") && !hasProviderKey(settings, "realtime")) {
    throw new ChecklistGenerateError("provider-missing");
  }
  const workload = hasProviderKey(settings, "deep") ? "deep" : "realtime";
  try {
    const { object, usage } = await generateObjectResilient({
      settings,
      workload,
      feature: "meeting",
      schema,
      system:
        "You turn pre-meeting notes into a checklist. Each item is one short line, " +
        "under 12 words, distinct from the others. Merge duplicates. Drop greetings and " +
        "meta notes that are not something to cover. Keep the language of the notes." +
        JSON_MODE_INSTRUCTION,
      prompt: notes,
    });
    void recordLlmUsage(settings, workload, "todo", usage);
    const items = normalizeItems(object.items);
    if (items.length === 0) throw new ChecklistGenerateError("claude-empty");
    return items;
  } catch (error) {
    if (error instanceof ChecklistGenerateError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new ChecklistGenerateError("provider-failed", detail);
  }
}
