import { describe, expect, it } from "vitest";
import { parsePreparedChecklist } from "./parse";

describe("parsePreparedChecklist", () => {
  it("reads the JSON shape an assistant would write", () => {
    const parsed = parsePreparedChecklist(
      "acme.json",
      JSON.stringify({
        title: "Acme renewal",
        meetingTime: "2026-10-29T15:00:00-07:00",
        context: "Dana owns the account.",
        items: ["Confirm who owns the budget", { text: "Ask about the timeline" }, ""],
      }),
    );
    expect(parsed).toEqual({
      title: "Acme renewal",
      meetingTime: "2026-10-29T15:00:00-07:00",
      context: "Dana owns the account.",
      items: ["Confirm who owns the budget", "Ask about the timeline"],
    });
  });

  it("reads markdown with front matter, a heading, and bullets", () => {
    const parsed = parsePreparedChecklist(
      "acme.md",
      [
        "---",
        "title: Acme renewal",
        "meetingTime: Thursday 3pm",
        "---",
        "",
        "Dana owns the account.",
        "",
        "- Confirm who owns the budget",
        "* Ask about the timeline",
        "1. Name the signer",
      ].join("\n"),
    );
    expect(parsed.title).toBe("Acme renewal");
    expect(parsed.meetingTime).toBe("Thursday 3pm");
    expect(parsed.context).toBe("Dana owns the account.");
    expect(parsed.items).toEqual([
      "Confirm who owns the budget",
      "Ask about the timeline",
      "Name the signer",
    ]);
  });

  it("uses the first heading and the file name as fallbacks", () => {
    const parsed = parsePreparedChecklist("q4-review.md", "# Q4 review\n\n- Open with the numbers");
    expect(parsed.title).toBe("Q4 review");
    expect(parsed.items).toEqual(["Open with the numbers"]);

    const named = parsePreparedChecklist("q4_review.json", JSON.stringify({ items: ["Open with the numbers"] }));
    expect(named.title).toBe("q4 review");
  });

  it("rejects a file with no items", () => {
    expect(() => parsePreparedChecklist("empty.json", "{}")).toThrow(/no checklist items/i);
    expect(() => parsePreparedChecklist("notes.md", "Just a paragraph.")).toThrow(/no checklist items/i);
    expect(() => parsePreparedChecklist("bad.json", "{")).toThrow(/could not be parsed/i);
  });
});
