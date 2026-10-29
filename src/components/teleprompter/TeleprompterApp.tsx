import { useEffect, useState } from "react";
import { Check, CircleDashed, Square } from "lucide-react";
import { useStore } from "../../lib/store";
import { useI18n } from "../../i18n";
import { isTauri } from "../../lib/tauriEvents";
import { emitEvent, listenIfTauri } from "../../lib/ipc/events";
import {
  TELEPROMPTER_READY,
  TELEPROMPTER_STATE,
  TELEPROMPTER_TOGGLE,
  type TeleprompterSnapshot,
} from "../../lib/teleprompterSync";
import { useThemePreference } from "../../lib/theme";
import type { TodoItem } from "../../lib/types";

const DEMO_TODOS: TodoItem[] = [
  { id: "demo-budget", text: "Confirm who owns the budget", done: false },
  { id: "demo-success", text: "Ask what success looks like in 90 days", done: false, coverage: "partial" },
  { id: "demo-date", text: "Agree a follow-up date", done: true, coverage: "done", locked: true },
];

/**
 * The compact checklist. Remaining items stay large; partly-covered items are
 * marked; done items collapse. A click is a manual check, which the classifier
 * will not undo. In the desktop app the main window owns the list and this
 * window follows it.
 */
export function TeleprompterApp() {
  const { t } = useI18n();
  useThemePreference();
  const storeTodos = useStore((s) => s.todos);
  const storeTitle = useStore((s) => s.meetingTitle);
  const storeAt = useStore((s) => s.meetingAt);
  const storeStatus = useStore((s) => s.meetingStatus);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const [remote, setRemote] = useState<TeleprompterSnapshot | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let stop: (() => void) | undefined;
    let active = true;
    void listenIfTauri<TeleprompterSnapshot>(TELEPROMPTER_STATE, (event) => {
      if (active) setRemote(event.payload);
    }).then((unlisten) => {
      if (!active) {
        unlisten();
        return;
      }
      stop = unlisten;
      void emitEvent(TELEPROMPTER_READY, {});
    });
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      void win.setContentProtected(true);
      void win.setAlwaysOnTop(true);
      void win.setVisibleOnAllWorkspaces(true);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const demo =
    import.meta.env.DEV &&
    (globalThis.location?.hash ?? "").includes("demo=1") &&
    storeTodos.length === 0 &&
    !remote;
  const todos = remote?.todos ?? (demo ? DEMO_TODOS : storeTodos);
  const title = remote?.title || storeTitle || (demo ? "Acme renewal" : "");
  const meetingAt = remote?.meetingAt ?? storeAt ?? (demo ? "Thursday 3:00 PM" : null);
  const live = (remote?.meetingStatus ?? storeStatus) === "recording" || (remote?.meetingStatus ?? storeStatus) === "paused";

  const remaining = todos.filter((todo) => !todo.done);
  const done = todos.filter((todo) => todo.done);

  function toggle(id: string) {
    if (isTauri()) {
      void emitEvent(TELEPROMPTER_TOGGLE, { id });
      setRemote((current) => {
        if (!current) return current;
        return {
          ...current,
          todos: current.todos.map((todo) =>
            todo.id === id
              ? { ...todo, done: !todo.done, locked: true, coverage: !todo.done ? "done" : "open", streak: 0 }
              : todo,
          ),
        };
      });
      return;
    }
    if (demo) return;
    toggleTodo(id);
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{title || t("teleprompter.titleFallback")}</h1>
          {meetingAt && <p className="truncate text-xs text-muted-foreground">{meetingAt}</p>}
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {live ? `${t("teleprompter.live")} · ` : ""}
          {remaining.length === 0 && todos.length > 0
            ? t("teleprompter.allDone")
            : t("teleprompter.remaining", { count: remaining.length })}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {todos.length === 0 ? (
          <p className="px-1 pt-8 text-center text-sm text-muted-foreground">{t("teleprompter.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {remaining.map((todo) => (
              <li key={todo.id}>
                <Row todo={todo} prominent onToggle={toggle} partialLabel={t("teleprompter.partial")} />
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDoneOpen((open) => !open)}
              className="px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("teleprompter.doneSummary", { count: done.length })}
              {doneOpen ? " ▾" : " ▸"}
            </button>
            {doneOpen && (
              <ul className="mt-1 flex flex-col gap-1">
                {done.map((todo) => (
                  <li key={todo.id}>
                    <Row todo={todo} prominent={false} onToggle={toggle} partialLabel={t("teleprompter.partial")} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  todo,
  prominent,
  partialLabel,
  onToggle,
}: Readonly<{
  todo: TodoItem;
  prominent: boolean;
  partialLabel: string;
  onToggle: (id: string) => void;
}>) {
  const partial = !todo.done && todo.coverage === "partial";
  return (
    <button
      type="button"
      onClick={() => onToggle(todo.id)}
      className={`flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-muted/60 ${
        prominent ? "text-base font-medium leading-snug" : "text-sm text-muted-foreground line-through"
      }`}
    >
      <Mark done={todo.done} partial={partial} />
      <span className="min-w-0 flex-1">
        {todo.text}
        {partial && (
          <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {partialLabel}
          </span>
        )}
      </span>
    </button>
  );
}

function Mark({ done, partial }: Readonly<{ done: boolean; partial: boolean }>) {
  if (done) return <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  if (partial) return <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  return <Square className="mt-0.5 size-4 shrink-0" />;
}
