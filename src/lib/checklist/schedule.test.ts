import { describe, expect, it } from "vitest";
import { JEV_SCORE_INTERVAL_MS, checklistScoreDue } from "./schedule";

const base = {
  now: 100_000,
  lastRunAt: 100_000,
  finalEndMs: 5_000,
  lastScoredEndMs: 5_000,
};

describe("checklistScoreDue", () => {
  it("does not score Jev again until new final speech has arrived", () => {
    expect(checklistScoreDue({ ...base, checker: "jev", now: base.lastRunAt + JEV_SCORE_INTERVAL_MS })).toBe(false);
    expect(
      checklistScoreDue({
        ...base,
        checker: "jev",
        now: base.lastRunAt + JEV_SCORE_INTERVAL_MS,
        finalEndMs: base.lastScoredEndMs + 1,
      }),
    ).toBe(true);
  });

  it("waits out the interval even when new speech just arrived", () => {
    expect(
      checklistScoreDue({
        ...base,
        checker: "jev",
        now: base.lastRunAt + JEV_SCORE_INTERVAL_MS - 1,
        finalEndMs: base.lastScoredEndMs + 1_000,
      }),
    ).toBe(false);
  });

  it("scores the first speech of a meeting", () => {
    expect(
      checklistScoreDue({ checker: "jev", now: 50_000, lastRunAt: 0, finalEndMs: 1_200, lastScoredEndMs: 0 }),
    ).toBe(true);
    expect(
      checklistScoreDue({ checker: "jev", now: 50_000, lastRunAt: 0, finalEndMs: 0, lastScoredEndMs: 0 }),
    ).toBe(false);
  });

  it("keeps the language-model checker on a wall clock, even with no new speech", () => {
    expect(checklistScoreDue({ ...base, checker: "llm", now: base.lastRunAt + 45_000 })).toBe(true);
    expect(checklistScoreDue({ ...base, checker: "llm", now: base.lastRunAt + 44_000 })).toBe(false);
  });
});
