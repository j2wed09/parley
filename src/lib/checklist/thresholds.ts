/** Defaults for the Jev check-off, tuned on jev-1.14.0.
 *
 *  Genuinely covered items scored 0.89–0.99. A passing one-line mention
 *  scored 0.30–0.77 and must not check the item off. Not-covered items
 *  stayed at or below 0.12. Run-to-run variance was about ±0.02.
 */

export const DEFAULT_JEV_DONE_THRESHOLD = 0.85;
export const DEFAULT_JEV_PARTIAL_THRESHOLD = 0.25;

export interface CoverageThresholds {
  doneThreshold: number;
  partialThreshold: number;
  /** A single high read marks the item touched. The second high read in a row
   *  checks it off. Off → one high read checks it off. */
  requireConsecutive: boolean;
}

export function resolveThresholds(opts: CoverageThresholds): CoverageThresholds {
  const done = clamp(opts.doneThreshold, DEFAULT_JEV_DONE_THRESHOLD);
  let partial = clamp(opts.partialThreshold, DEFAULT_JEV_PARTIAL_THRESHOLD);
  if (partial >= done) partial = Math.max(0.01, Number((done - 0.05).toFixed(2)));
  return { doneThreshold: done, partialThreshold: partial, requireConsecutive: opts.requireConsecutive };
}

function clamp(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.99, Math.max(0.01, n));
}
