import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../log", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  attachConsoleOnce: vi.fn(),
}));

const ipc = vi.hoisted(() => ({
  classifyWithJev: vi.fn(),
}));
vi.mock("../ipc/commands", () => ipc);

const llm = vi.hoisted(() => ({
  checkTodos: vi.fn(),
}));
vi.mock("../ai/todos", () => llm);

import { useStore } from "../store";
import { seg } from "../test/fixtures";
import { runChecklistCheck } from "./run";

const INITIAL = useStore.getState();

function reset() {
  useStore.setState(INITIAL, true);
  ipc.classifyWithJev.mockReset();
  llm.checkTodos.mockReset();
}

function highAnswers(probability: number) {
  ipc.classifyWithJev.mockImplementation(async (args: { request: { questions: Record<string, unknown> } }) => {
    const answers = Object.fromEntries(
      Object.keys(args.request.questions).map((id) => [id, { type: "noul", noul: probability }]),
    );
    return { model: "jev-1.14.0", answers, usage: { input_tokens: 1, output_tokens: 1 } };
  });
}

beforeEach(reset);

describe("runChecklistCheck", () => {
  it("checks an item off only after two consecutive high Jev reads", async () => {
    useStore.getState().applyTodoTemplate(["Confirm the budget"]);
    useStore.setState({ segments: [seg({ text: "I own the budget and can sign." })] });
    highAnswers(0.92);

    await runChecklistCheck();
    expect(useStore.getState().todos[0]).toMatchObject({ done: false, coverage: "partial", streak: 1 });
    expect(llm.checkTodos).not.toHaveBeenCalled();

    await runChecklistCheck();
    expect(useStore.getState().todos[0]).toMatchObject({ done: true, coverage: "done", streak: 2 });
  });

  it("does not re-check an item the user unchecked", async () => {
    useStore.getState().applyTodoTemplate(["Confirm the budget"]);
    const id = useStore.getState().todos[0].id;
    useStore.getState().toggleTodo(id);
    useStore.getState().toggleTodo(id);
    useStore.setState({ segments: [seg({ text: "The budget is approved." })] });
    highAnswers(0.99);

    const result = await runChecklistCheck();
    expect(result).toEqual({ skip: "no-items" });
    expect(ipc.classifyWithJev).not.toHaveBeenCalled();
    expect(useStore.getState().todos[0]).toMatchObject({ done: false, locked: true });
  });

  it("uses the LLM fallback when that checker is selected", async () => {
    useStore.getState().applyTodoTemplate(["Confirm the budget"]);
    useStore.getState().updateSettings({ todoChecker: "llm", groqApiKey: "test-key" });
    useStore.setState({ segments: [seg({ text: "Budget is settled." })] });
    const id = useStore.getState().todos[0].id;
    llm.checkTodos.mockResolvedValue([id]);

    const result = await runChecklistCheck();
    expect(result).toEqual({ marked: 1 });
    expect(ipc.classifyWithJev).not.toHaveBeenCalled();
    expect(useStore.getState().todos[0].done).toBe(true);
    expect(useStore.getState().todos[0].locked).toBeUndefined();
  });

  it("skips the LLM fallback when no provider key is configured", async () => {
    useStore.getState().applyTodoTemplate(["Confirm the budget"]);
    useStore.getState().updateSettings({ todoChecker: "llm", groqApiKey: "" });
    useStore.setState({ segments: [seg({ text: "Budget is settled." })] });
    const result = await runChecklistCheck();
    expect(result).toEqual({ skip: "no-key" });
    expect(llm.checkTodos).not.toHaveBeenCalled();
  });
});
