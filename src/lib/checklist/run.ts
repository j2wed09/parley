import { checkTodos } from "../ai/todos";
import { hasProviderKey } from "../ai/settings";
import { meetingBriefText, transcriptAsText, useStore } from "../store";
import * as ipc from "../ipc/commands";
import { applyChecklistReadings } from "./coverage";
import { buildJevRequest, readingsFromJevResponse } from "./jev";

export type ChecklistCheckSkip = "no-items" | "no-transcript" | "no-key";

/**
 * Score the open checklist against the transcript so far and move items
 * forward. Jev is the default; the configured LLM is the fallback and only
 * returns a done/not-done set (no partial state).
 *
 * Callers that just want the side effect can ignore the return. A skip is not
 * a failure — there was nothing to do, or the chosen checker is not set up.
 */
export async function runChecklistCheck(): Promise<{ marked: number } | { skip: ChecklistCheckSkip }> {
  const state = useStore.getState();
  const open = state.todos.filter((todo) => !todo.done && !todo.locked && todo.text.trim());
  if (open.length === 0) return { skip: "no-items" };

  if (state.settings.todoChecker === "llm") {
    return runLlmCheck();
  }
  return runJevCheck();
}

async function runJevCheck(): Promise<{ marked: number } | { skip: ChecklistCheckSkip }> {
  const state = useStore.getState();
  const open = state.todos.filter((todo) => !todo.done && !todo.locked && todo.text.trim());
  const transcript = transcriptAsText(state.segments, state.speakerNames);
  const request = buildJevRequest({
    title: state.meetingTitle,
    context: meetingBriefText(state),
    transcript,
    items: open,
  });
  if (!request) return { skip: "no-transcript" };

  const body = await ipc.classifyWithJev({ request });
  const readings = readingsFromJevResponse(body).map((reading) => ({
    ...reading,
    text: open.find((todo) => todo.id === reading.id)?.text,
  }));
  // Re-read after the await so a manual toggle during the request wins.
  const current = useStore.getState().todos;
  const before = current.filter((todo) => todo.done).length;
  const next = applyChecklistReadings(current, readings, {
    doneThreshold: state.settings.jevDoneThreshold,
    partialThreshold: state.settings.jevPartialThreshold,
    requireConsecutive: state.settings.jevRequireConsecutive,
  });
  if (next !== current) useStore.getState().setTodos(next);
  return { marked: next.filter((todo) => todo.done).length - before };
}

async function runLlmCheck(): Promise<{ marked: number } | { skip: ChecklistCheckSkip }> {
  const state = useStore.getState();
  if (!hasProviderKey(state.settings, "realtime")) return { skip: "no-key" };
  const transcript = transcriptAsText(state.segments, state.speakerNames);
  if (!transcript.trim()) return { skip: "no-transcript" };
  const ids = await checkTodos({
    settings: state.settings,
    segments: state.segments,
    todos: state.todos,
    names: state.speakerNames,
  });
  if (ids.length === 0) return { marked: 0 };
  useStore.getState().markTodosDone(ids);
  return { marked: ids.length };
}
