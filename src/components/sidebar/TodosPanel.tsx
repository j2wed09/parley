import { useState } from "react";
import { Check, CircleDashed, Square, X, Plus, Sparkles, TvMinimal } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { useI18n } from "../../i18n";
import { openTeleprompter } from "../../lib/teleprompter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TodoItem } from "../../lib/types";

/**
 * The live meeting checklist: the agenda rail beside the coach feed. Items are
 * ACTION items ("get the budget signed off"), added by hand or from a TODO
 * template; the background engine auto-checks them off as they get covered, and
 * the AI button runs that same check on demand.
 */

function TodoRow({ todo }: Readonly<{ todo: TodoItem }>) {
  const { t } = useI18n();
  const toggleTodo = useStore((s) => s.toggleTodo);
  const removeTodo = useStore((s) => s.removeTodo);
  return (
    <div className="group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
      <button
        type="button"
        onClick={() => toggleTodo(todo.id)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
      >
        {todo.done ? (
          <Check className="size-4 text-success-foreground" />
        ) : todo.coverage === "partial" ? (
          <CircleDashed className="size-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <Square className="size-4" />
        )}
      </button>
      <span
        className={`flex-1 text-sm leading-snug ${todo.done ? "text-muted-foreground line-through" : ""}`}
      >
        {todo.text}
        {!todo.done && todo.coverage === "partial" && (
          <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t("todos.partial")}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => removeTodo(todo.id)}
        className="shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function AddForm() {
  const { t } = useI18n();
  const addTodo = useStore((s) => s.addTodo);
  const [input, setInput] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    addTodo(input);
    setInput("");
  }
  return (
    <form
      onSubmit={add}
      className="flex items-center gap-2 border-t p-2.5"
    >
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("todos.addPlaceholder")}
        className="h-8 text-sm"
      />
      <Button
        type="submit"
        size="icon"
        className="size-8 shrink-0"
        disabled={!input.trim()}
      >
        <Plus className="size-4" />
      </Button>
    </form>
  );
}

export function TodosPanel() {
  const { t } = useI18n();
  const todos = useStore((s) => s.todos);
  const templates = useStore((s) => s.settings.todoTemplates);
  const applyTodoTemplate = useStore((s) => s.applyTodoTemplate);
  const [checking, setChecking] = useState(false);

  const done = todos.filter((x) => x.done).length;

  async function aiUpdate() {
    if (todos.length === 0) return;
    setChecking(true);
    try {
      const { runChecklistCheck } = await import("../../lib/checklist/run");
      const result = await runChecklistCheck();
      if ("skip" in result && result.skip === "no-key") toast.error(t("check.err.noKey"));
      else if ("skip" in result && result.skip === "no-transcript") toast.message(t("check.err.noTranscript"));
    } catch (e) {
      console.error("checkTodos failed", e);
      toast.error(t("check.err.failed"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="shrink-0">
          {todos.length > 0 ? t("todos.doneCount", { done, total: todos.length }) : t("todos.noItems")}
        </span>
        {templates.length > 0 && (
          <select
            aria-label={t("todos.applyTemplate")}
            className="ml-auto h-6 max-w-28 rounded-md border bg-transparent px-1 text-[11px]"
            value=""
            onChange={(event) => {
              const template = templates.find((item) => item.id === event.target.value);
              if (template) applyTodoTemplate(template.items);
            }}
          >
            <option value="">{t("todos.applyTemplate")}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        )}
        <Button
          variant="outline"
          size="sm"
          className={`h-6 shrink-0 px-2 text-[11px] ${templates.length > 0 ? "" : "ml-auto"}`}
          disabled={checking || todos.length === 0}
          onClick={aiUpdate}
          title={t("todos.aiTitle")}
        >
          <Sparkles className={`size-3 ${checking ? "animate-pulse" : ""}`} />
          AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-[11px]"
          onClick={() => {
            void openTeleprompter().catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : String(error));
            });
          }}
          title={t("prep.teleprompter")}
        >
          <TvMinimal className="size-3" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 px-3 pb-3">
          {todos.length === 0 ? (
            <p className="px-1 pt-6 text-center text-xs text-muted-foreground">
              {t("todos.empty")}
            </p>
          ) : (
            todos.map((x) => <TodoRow key={x.id} todo={x} />)
          )}
        </div>
      </ScrollArea>

      <AddForm />
    </div>
  );
}
