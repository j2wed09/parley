import { describe, expect, it } from "vitest";
import {
  JEV_MODEL,
  JEV_QUESTION_PREFIX,
  buildJevRequest,
  jevInstructions,
  maxStateChars,
  readingsFromJevResponse,
  trimTranscript,
} from "./jev";

describe("Jev checklist questions", () => {
  it("asks every item with the same yes-polarity wording", () => {
    const items = [
      { id: "budget", text: "Confirm who owns the budget" },
      { id: "date", text: "Agree a follow-up date" },
    ];
    const request = buildJevRequest({
      title: "Acme renewal",
      context: "Dana owns the account.",
      transcript: "[me] Hello\n[them] Hi",
      items,
    });
    expect(request).not.toBeNull();
    expect(request?.model).toBe(JEV_MODEL);
    expect(Object.keys(request!.questions)).toEqual(["budget", "date"]);
    for (const item of items) {
      const instructions = request!.questions[item.id].instructions;
      expect(request!.questions[item.id].type).toBe("noul");
      expect(instructions.startsWith(JEV_QUESTION_PREFIX)).toBe(true);
      expect(instructions).toBe(jevInstructions(item.text));
      expect(instructions).toContain(`"${item.text}"`);
    }
    expect(request?.state).toContain("Meeting: Acme renewal");
    expect(request?.state).toContain("Dana owns the account.");
    expect(request?.state).toContain("[them] Hi");
  });

  it("returns null without a transcript or without items", () => {
    expect(buildJevRequest({ transcript: "   ", items: [{ id: "a", text: "Ask" }] })).toBeNull();
    expect(buildJevRequest({ transcript: "[me] Hi", items: [] })).toBeNull();
  });

  it("drops the oldest transcript lines to stay inside the per-question budget", () => {
    const items = [{ id: "a", text: "Confirm the budget" }];
    const questions = [{ instructions: jevInstructions(items[0].text) }];
    const budget = maxStateChars(questions);
    const lines = Array.from({ length: 8_000 }, (_, i) =>
      i === 0 ? `OLD_LINE_SHOULD_DROP ${"padding ".repeat(30)}` : `line ${i} ${"x".repeat(40)}`,
    );
    lines[lines.length - 1] = "NEWEST_LINE_KEEP";
    const request = buildJevRequest({ transcript: lines.join("\n"), items });
    expect(request).not.toBeNull();
    expect(request!.state.length).toBeLessThanOrEqual(budget);
    expect(request!.state).toContain("NEWEST_LINE_KEEP");
    expect(request!.state).not.toContain("OLD_LINE_SHOULD_DROP");
    expect(request!.state).toContain("Earlier transcript omitted");
  });

  it("trims by whole lines and keeps the newest one", () => {
    const text = ["one", "two", "three", "four"].join("\n");
    const trimmed = trimTranscript(text, 10);
    expect(trimmed).toContain("four");
    expect(trimmed).not.toContain("one");
  });
});

describe("readingsFromJevResponse", () => {
  it("reads answers[<id>].noul and clamps it to 0–1", () => {
    const readings = readingsFromJevResponse({
      model: "jev-1.14.0",
      answers: {
        budget: { type: "noul", noul: 0.91 },
        date: { type: "noul", noul: 1.4 },
        other: { type: "choice", choice: "no" },
      },
      usage: { input_tokens: 10, output_tokens: 2 },
    });
    expect(readings).toEqual([
      { id: "budget", probability: 0.91 },
      { id: "date", probability: 1 },
    ]);
  });

  it("rejects a body with no answers object", () => {
    expect(() => readingsFromJevResponse({ model: "jev-latest" })).toThrow(/answers/);
  });
});
