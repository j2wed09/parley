import { describe, expect, it } from "vitest";
import { applyChecklistReadings } from "./coverage";
import type { TodoItem } from "../types";

const opts = { doneThreshold: 0.75, partialThreshold: 0.4, requireConsecutive: true };

function item(partial: Partial<TodoItem> & Pick<TodoItem, "id" | "text">): TodoItem {
  return { done: false, ...partial };
}

describe("applyChecklistReadings", () => {
  it("marks an item touched on the first high read and done on the second", () => {
    const open = [item({ id: "a", text: "Confirm the budget" })];
    const once = applyChecklistReadings(open, [{ id: "a", probability: 0.91, text: "Confirm the budget" }], opts);
    expect(once[0]).toMatchObject({ done: false, coverage: "partial", streak: 1 });
    const twice = applyChecklistReadings(once, [{ id: "a", probability: 0.88, text: "Confirm the budget" }], opts);
    expect(twice[0]).toMatchObject({ done: true, coverage: "done", streak: 2 });
  });

  it("checks off on a single high read when consecutive confirmation is off", () => {
    const next = applyChecklistReadings(
      [item({ id: "a", text: "Ask for the date" })],
      [{ id: "a", probability: 0.8 }],
      { ...opts, requireConsecutive: false },
    );
    expect(next[0].done).toBe(true);
    expect(next[0].coverage).toBe("done");
  });

  it("marks a mid-range score as partly covered and resets the streak", () => {
    const start = [item({ id: "a", text: "Success", coverage: "partial", streak: 1 })];
    const next = applyChecklistReadings(start, [{ id: "a", probability: 0.55 }], opts);
    expect(next[0]).toMatchObject({ done: false, coverage: "partial", streak: 0 });
  });

  it("does not downgrade a partly covered item when the score drops", () => {
    const start = [item({ id: "a", text: "Success", coverage: "partial", streak: 0 })];
    const next = applyChecklistReadings(start, [{ id: "a", probability: 0.1 }], opts);
    expect(next).toBe(start);
    expect(next[0].coverage).toBe("partial");
    expect(next[0].done).toBe(false);
  });

  it("never unchecks or rewrites an item that is already done", () => {
    const start = [item({ id: "a", text: "Budget", done: true, coverage: "done", streak: 2 })];
    const next = applyChecklistReadings(start, [{ id: "a", probability: 0.01 }], opts);
    expect(next).toBe(start);
  });

  it("never overrides a manual check or uncheck", () => {
    const unchecked = [item({ id: "a", text: "Budget", done: false, locked: true, coverage: "open" })];
    expect(applyChecklistReadings(unchecked, [{ id: "a", probability: 0.99 }], opts)).toBe(unchecked);

    const checked = [item({ id: "b", text: "Date", done: true, locked: true, coverage: "done" })];
    const next = applyChecklistReadings(checked, [{ id: "b", probability: 0.01 }], opts);
    expect(next).toBe(checked);
    expect(next[0].done).toBe(true);
  });

  it("ignores a reading whose item text changed while the request was in flight", () => {
    const start = [item({ id: "a", text: "New wording" })];
    const next = applyChecklistReadings(start, [{ id: "a", probability: 0.99, text: "Old wording" }], opts);
    expect(next).toBe(start);
  });

  it("leaves items with no reading alone", () => {
    const start = [item({ id: "a", text: "One" }), item({ id: "b", text: "Two" })];
    const next = applyChecklistReadings(start, [{ id: "a", probability: 0.5 }], opts);
    expect(next[1]).toBe(start[1]);
    expect(next[0].coverage).toBe("partial");
  });
});
