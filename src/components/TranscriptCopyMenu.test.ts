import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Radix renders menu content into a portal only once opened, which a server
// render never does — so the menu parts are swapped for inline stand-ins that
// render every item in order.
vi.mock("radix-ui", async (orig) => {
  const pass = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    ...(await orig<typeof import("radix-ui")>()),
    DropdownMenu: {
      Root: pass,
      Trigger: pass,
      Portal: pass,
      Content: pass,
      Item: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) =>
        createElement("div", { "data-item": "", "data-disabled": disabled ? "" : undefined }, children),
      Separator: () => createElement("hr"),
    },
  };
});

vi.mock("../lib/onboarding/useHandoff", () => ({
  useHandoff: () => ({
    questions: [],
    mcpQuestions: [],
    canCopy: true,
    copyPrompt: async () => true,
    reportMarkdown: () => "",
  }),
}));

import { TranscriptCopyMenu } from "./TranscriptCopyMenu";

describe("TranscriptCopyMenu", () => {
  const html = renderToStaticMarkup(
    createElement(TranscriptCopyMenu, { segments: [], speakerNames: {} })
  );

  it("offers the analysis-prompt copy first, above a hairline and the three formats", () => {
    const items = html.split("data-item").slice(1);
    expect(items).toHaveLength(4);
    expect(items[0]).toContain("With analysis prompt");
    expect(items[0]).toContain("Paste straight into ChatGPT or Claude");
    expect(items[1]).toContain("With speaker");
    expect(items[2]).toContain("Plain text");
    expect(items[3]).toContain("With speaker &amp; time");
    const hr = html.indexOf("<hr");
    expect(hr).toBeGreaterThan(html.indexOf("With analysis prompt"));
    expect(hr).toBeLessThan(html.indexOf("Each line labelled by speaker"));
  });

  it("explains the new item the first time the menu opens", () => {
    const explainer = html.indexOf("Want ChatGPT or Claude to analyze this? Pick “With analysis prompt” and paste.");
    expect(explainer).toBeGreaterThan(-1);
    expect(explainer).toBeLessThan(html.indexOf("data-item"));
  });
});
