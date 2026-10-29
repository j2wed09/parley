/** How often the live checker may run. Jev also requires new final speech,
 *  so two highs in a row are two different transcripts. */
export const JEV_SCORE_INTERVAL_MS = 15_000;
export const LLM_SCORE_INTERVAL_MS = 45_000;

/**
 * Whether the background checker should call the model on this tick.
 *
 * Jev does not re-score a transcript it has already scored. The 15s gap is
 * only a minimum between scores of *new* final speech. The language-model
 * fallback has no two-in-a-row rule, so it keeps the slower wall-clock cadence.
 */
export function checklistScoreDue(opts: {
  checker: "jev" | "llm";
  now: number;
  lastRunAt: number;
  finalEndMs: number;
  lastScoredEndMs: number;
}): boolean {
  if (opts.checker === "llm") {
    return opts.now >= opts.lastRunAt + LLM_SCORE_INTERVAL_MS;
  }
  return opts.finalEndMs > opts.lastScoredEndMs && opts.now >= opts.lastRunAt + JEV_SCORE_INTERVAL_MS;
}
