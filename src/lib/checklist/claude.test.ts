import { describe, expect, it } from "vitest";
import { claudeChecklistPrompt, interpretClaudeRun, type ClaudeRun } from "./claude";

function run(partial: Partial<ClaudeRun>): ClaudeRun {
  return { notFound: false, exitCode: 0, stdout: "", stderr: "", ...partial };
}

describe("interpretClaudeRun", () => {
  it("reads a JSON array out of Claude's result wrapper", () => {
    const stdout = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: '["Confirm the budget owner", "Ask about the timeline"]',
    });
    expect(interpretClaudeRun(run({ stdout }))).toEqual({
      ok: true,
      items: ["Confirm the budget owner", "Ask about the timeline"],
    });
  });

  it("accepts a fenced array and drops duplicates and blanks", () => {
    const stdout = JSON.stringify({
      is_error: false,
      result: '```json\n["Ask about timeline", "", "ask about timeline", "Name the signer"]\n```',
    });
    const read = interpretClaudeRun(run({ stdout }));
    expect(read).toEqual({ ok: true, items: ["Ask about timeline", "Name the signer"] });
  });

  it("uses the last JSON line when the CLI prints a stream", () => {
    const stdout = [
      JSON.stringify({ type: "system" }),
      JSON.stringify({ type: "result", is_error: false, result: '["Only this one"]' }),
    ].join("\n");
    expect(interpretClaudeRun(run({ stdout }))).toEqual({ ok: true, items: ["Only this one"] });
  });

  it("says when the CLI is not installed", () => {
    expect(interpretClaudeRun(run({ notFound: true, exitCode: 127 }))).toMatchObject({
      ok: false,
      code: "claude-missing",
    });
  });

  it("says when Claude is not logged in", () => {
    const read = interpretClaudeRun(run({ exitCode: 1, stderr: "Not logged in. Run claude to sign in." }));
    expect(read).toMatchObject({ ok: false, code: "claude-login" });
  });

  it("surfaces a failed run and an empty checklist", () => {
    expect(interpretClaudeRun(run({ exitCode: 1, stderr: "model overloaded" }))).toMatchObject({
      ok: false,
      code: "claude-failed",
    });
    const empty = interpretClaudeRun(run({ stdout: JSON.stringify({ is_error: false, result: "[]" }) }));
    expect(empty).toMatchObject({ ok: false, code: "claude-empty" });
  });

  it("rejects output that is not a checklist", () => {
    const stdout = JSON.stringify({ is_error: false, result: "Sure, here are some thoughts." });
    expect(interpretClaudeRun(run({ stdout }))).toMatchObject({ ok: false, code: "claude-unreadable" });
  });
});

describe("claudeChecklistPrompt", () => {
  it("includes the notes and asks for a JSON array", () => {
    const prompt = claudeChecklistPrompt("  walk the redlines  ");
    expect(prompt).toContain("walk the redlines");
    expect(prompt).toContain("JSON array of strings");
  });
});
