import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Merge, Plus, Sparkles, Trash2, TvMinimal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { useStore, isMeetingActive } from "../../lib/store";
import { beginMeeting } from "../../lib/meeting/start";
import { openTeleprompter } from "../../lib/teleprompter";
import { ChecklistGenerateError } from "../../lib/checklist/generate";
import { log } from "../../lib/log";
import { ConfirmDialog } from "../shell/ConfirmDialog";

/**
 * Before the meeting: paste a brain dump, generate a checklist (Claude Code
 * on this Mac, or the configured LLM), then edit it and start.
 */
export function PrepScreen() {
  const { t } = useI18n();
  const setPrepOpen = useStore((s) => s.setPrepOpen);
  const meetingTitle = useStore((s) => s.meetingTitle);
  const setMeetingTitle = useStore((s) => s.setMeetingTitle);
  const meetingAt = useStore((s) => s.meetingAt);
  const setMeetingAt = useStore((s) => s.setMeetingAt);
  const meetingContext = useStore((s) => s.meetingContext);
  const setMeetingContext = useStore((s) => s.setMeetingContext);
  const todos = useStore((s) => s.todos);
  const templates = useStore((s) => s.settings.todoTemplates);
  const generator = useStore((s) => s.settings.checklistGenerator);
  const applyTodoTemplate = useStore((s) => s.applyTodoTemplate);
  const addTodo = useStore((s) => s.addTodo);
  const updateTodoText = useStore((s) => s.updateTodoText);
  const moveTodo = useStore((s) => s.moveTodo);
  const mergeTodoWithNext = useStore((s) => s.mergeTodoWithNext);
  const removeTodo = useStore((s) => s.removeTodo);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);

  async function generate(text: string) {
    setGenerating(true);
    setError("");
    try {
      const { generateChecklist } = await import("../../lib/checklist/generate");
      const items = await generateChecklist(text);
      applyTodoTemplate(items);
    } catch (caught) {
      const message = caught instanceof ChecklistGenerateError ? explain(caught, t) : String(caught);
      setError(message);
      log.warn("prep: generate failed", { error: message });
    } finally {
      setGenerating(false);
    }
  }

  function askGenerate() {
    const text = notes.trim();
    if (!text) {
      setError(t("prep.err.noNotes"));
      return;
    }
    if (todos.length > 0) {
      setPendingReplace(text);
      return;
    }
    void generate(text);
  }

  async function start() {
    await beginMeeting();
    if (isMeetingActive(useStore.getState().meetingStatus)) setPrepOpen(false);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setPrepOpen(false)}>
            <ArrowLeft className="size-4" />
            {t("prep.back")}
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">{t("prep.kicker")}</h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {t("prep.meetingTitle")}
            <Input
              value={meetingTitle}
              onChange={(event) => setMeetingTitle(event.target.value)}
              placeholder={t("prep.meetingTitlePlaceholder")}
              className="h-9 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {t("prep.meetingTime")}
            <Input
              value={meetingAt ?? ""}
              onChange={(event) => setMeetingAt(event.target.value || null)}
              placeholder={t("prep.meetingTimePlaceholder")}
              className="h-9 text-sm text-foreground"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {t("prep.context")}
          <Textarea
            value={meetingContext}
            onChange={(event) => setMeetingContext(event.target.value)}
            placeholder={t("prep.contextPlaceholder")}
            className="min-h-16 text-sm text-foreground"
          />
        </label>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {t("prep.notes")}
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("prep.notesPlaceholder")}
              className="min-h-32 text-sm text-foreground"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={generating} onClick={askGenerate}>
              <Sparkles className={`size-3.5 ${generating ? "animate-pulse" : ""}`} />
              {generating ? t("prep.generating") : t("prep.generate")}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {generator === "provider" ? t("prep.usingProvider") : t("prep.usingClaude")}
            </span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{t("prep.checklist")}</h2>
            {templates.length > 0 && (
              <select
                aria-label={t("todos.applyTemplate")}
                className="ml-auto h-8 max-w-56 rounded-lg border bg-transparent px-2 text-xs"
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
          </div>
          {todos.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("prep.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todos.map((todo, index) => (
                <li key={todo.id} className="flex items-center gap-1">
                  <Input
                    value={todo.text}
                    onChange={(event) => updateTodoText(todo.id, event.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("prep.moveUp")}
                    disabled={index === 0}
                    onClick={() => moveTodo(todo.id, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("prep.moveDown")}
                    disabled={index === todos.length - 1}
                    onClick={() => moveTodo(todo.id, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("prep.merge")}
                    disabled={index === todos.length - 1}
                    onClick={() => mergeTodoWithNext(todo.id)}
                  >
                    <Merge className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("prep.delete")}
                    onClick={() => removeTodo(todo.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addTodo(draft);
              setDraft("");
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("prep.addPlaceholder")}
              className="h-8 text-sm"
            />
            <Button type="submit" size="icon" className="size-8 shrink-0" disabled={!draft.trim()}>
              <Plus className="size-4" />
            </Button>
          </form>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              start().catch((caught: unknown) => {
                log.error("prep: start failed", { error: String(caught) });
                toast.error(caught instanceof Error ? caught.message : String(caught));
              });
            }}
          >
            {t("prep.start")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void openTeleprompter().catch((caught: unknown) => {
                log.error("prep: teleprompter failed", { error: String(caught) });
                toast.error(caught instanceof Error ? caught.message : String(caught));
              });
            }}
          >
            <TvMinimal className="size-4" />
            {t("prep.teleprompter")}
          </Button>
        </div>
      </div>
      {pendingReplace != null && (
        <ConfirmDialog
          title={t("prep.replaceTitle")}
          body={t("prep.replaceBody")}
          confirmLabel={t("prep.replaceConfirm")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => {
            const text = pendingReplace;
            setPendingReplace(null);
            void generate(text);
          }}
          onCancel={() => setPendingReplace(null)}
        />
      )}
    </div>
  );
}

function explain(
  error: ChecklistGenerateError,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (error.code) {
    case "no-notes":
      return t("prep.err.noNotes");
    case "claude-missing":
      return t("prep.err.claudeMissing");
    case "claude-login":
      return t("prep.err.claudeLogin");
    case "claude-failed":
      return t("prep.err.claudeFailed", { detail: error.detail });
    case "claude-empty":
      return t("prep.err.claudeEmpty");
    case "claude-unreadable":
      return t("prep.err.claudeUnreadable");
    case "provider-missing":
      return t("prep.err.providerMissing");
    case "provider-failed":
      return t("prep.err.providerFailed", { detail: error.detail });
    default:
      return error.detail || error.code;
  }
}
