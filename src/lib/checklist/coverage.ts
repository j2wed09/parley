import type { TodoItem } from "../types";
import { resolveThresholds, type CoverageThresholds } from "./thresholds";

/** One Jev answer, tied back to the item that was asked about. */
export interface ChecklistReading {
  id: string;
  /** 0–1. Higher means "this item has been covered." */
  probability: number;
  /** When set, the reading is dropped if the item text changed while the
   *  request was in flight. */
  text?: string;
}

/**
 * Fold a Jev pass into the checklist.
 *
 * The classifier only ever moves an item forward: open → partial → done.
 * It never unchecks, never clears a partial back to open, and never touches
 * an item the user checked or unchecked by hand (`locked`).
 *
 * Returns the same array when nothing changed, so a caller can skip a write.
 */
export function applyChecklistReadings(
  todos: TodoItem[],
  readings: readonly ChecklistReading[],
  opts: CoverageThresholds,
): TodoItem[] {
  const thresholds = resolveThresholds(opts);
  const byId = new Map(readings.map((r) => [r.id, r]));
  let changed = false;
  const next = todos.map((todo) => {
    const updated = applyOne(todo, byId.get(todo.id), thresholds);
    if (updated !== todo) changed = true;
    return updated;
  });
  return changed ? next : todos;
}

function applyOne(
  todo: TodoItem,
  reading: ChecklistReading | undefined,
  opts: CoverageThresholds,
): TodoItem {
  if (!reading) return todo;
  if (reading.text != null && reading.text !== todo.text) return todo;
  // A manual check or uncheck is final until the user touches it again.
  if (todo.locked || todo.done) return todo;
  const p = reading.probability;
  if (!Number.isFinite(p)) return todo;

  if (p >= opts.doneThreshold) {
    const streak = (todo.streak ?? 0) + 1;
    if (!opts.requireConsecutive || streak >= 2) {
      return { ...todo, done: true, coverage: "done", streak };
    }
    if (todo.coverage === "partial" && todo.streak === streak) return todo;
    return { ...todo, coverage: "partial", streak };
  }

  if (p >= opts.partialThreshold) {
    if (todo.coverage === "partial" && (todo.streak ?? 0) === 0) return todo;
    return { ...todo, coverage: "partial", streak: 0 };
  }

  // Below the partial line: leave coverage where it is. A low read must not
  // wipe a "partly covered" mark. It does break a consecutive-high streak.
  if ((todo.streak ?? 0) === 0) return todo;
  return { ...todo, streak: 0 };
}
