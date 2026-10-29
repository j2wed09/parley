/**
 * Send a sample transcript and checklist to TypeSafe Jev and print the
 * probability for each item.
 *
 * Usage:
 *   TYPESAFE_API_KEY=... bun scripts/jev-smoke-test.ts
 *
 * The key is read from the environment only. Nothing in this script, or in
 * the app, hardcodes one. Use the printed probabilities to tune
 * jevDoneThreshold (default 0.85) and jevPartialThreshold (default 0.25).
 */
import { buildJevRequest, readingsFromJevResponse } from "../src/lib/checklist/jev";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const transcript = [
  "[me] Thanks for making time, Dana. I want to confirm who owns the budget on your side.",
  "[them] That's me. I own the budget, and I can sign up to forty thousand without another approval.",
  "[me] Good. What would success look like ninety days after you start?",
  "[them] We have not written that down yet. Let's come back to it next week.",
  "[me] Understood. I'll send a recap after this call.",
].join("\n");

const items = [
  { id: "budget", text: "Confirm who owns the budget" },
  { id: "success", text: "Ask what success looks like in 90 days" },
  { id: "legal", text: "Walk through the legal redlines" },
  { id: "followup", text: "Agree a follow-up date" },
];

async function main(): Promise<void> {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) {
    console.error("Set TYPESAFE_API_KEY in the environment. This script does not read a key from the repo.");
    process.exitCode = 1;
    return;
  }

  const request = buildJevRequest({
    title: "Acme renewal",
    context: "Renewal call with Dana, who owns the account.",
    transcript,
    items,
  });
  if (!request) {
    console.error("Sample request was empty.");
    process.exitCode = 1;
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const raw = await response.text();
  if (!response.ok) {
    console.error(`TypeSafe returned ${response.status}: ${raw.slice(0, 500)}`);
    process.exitCode = 1;
    return;
  }

  const body = JSON.parse(raw) as { model?: string };
  const readings = readingsFromJevResponse(JSON.parse(raw));
  const byId = new Map(readings.map((reading) => [reading.id, reading.probability]));
  console.log(`request model: ${request.model}`);
  console.log(`response model: ${body.model ?? "(missing)"}`);
  console.log("id        probability  item");
  for (const item of items) {
    const probability = byId.get(item.id);
    const shown = probability == null ? "  —  " : probability.toFixed(3).padStart(5, " ");
    console.log(`${item.id.padEnd(10)} ${shown}        ${item.text}`);
  }
  console.log("");
  console.log("Done threshold starts at 0.85, partial at 0.25. Two highs in a row, on two different transcripts, check an item off.");
}

await main();
