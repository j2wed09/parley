// Everything the user sets up FOR one meeting: context, negotiation setup,
// agenda checklist, and where it will be filed / shared.

import type { TodoCoverage, TodoItem } from "../types";
import type { PreparedChecklist } from "../checklist/parse";
import type { MeetingShare } from "../history/history";
import { log } from "../log";
import { isMeetingActive } from "./meeting";
import type { SliceCreator } from "./types";

export interface PrepSlice {
  /** Meeting to-do / agenda checklist. */
  todos: TodoItem[];
  /** Title of the meeting being prepared. Shown on the teleprompter. */
  meetingTitle: string;
  setMeetingTitle: (text: string) => void;
  /** Optional clock time from a prepared checklist. Display only. */
  meetingAt: string | null;
  setMeetingAt: (text: string | null) => void;
  /** The pre-meeting checklist screen is up (home route only). */
  prepOpen: boolean;
  setPrepOpen: (open: boolean) => void;
  /** Per-meeting context/description (who's here, roles) — NOT a global setting. */
  meetingContext: string;
  setMeetingContext: (text: string) => void;
  /** Principled-negotiation setup for THIS deal (per-meeting, not global). Feeds
   *  BATNA / ZOPA / walk-away reasoning in the analysis. */
  meetingBatna: string;
  meetingTarget: string;
  meetingFloor: string;
  setNegotiationField: (field: "meetingBatna" | "meetingTarget" | "meetingFloor", value: string) => void;

  // ── Filing for the current/upcoming meeting ─────────────────────────────────
  /** Folder this meeting will be saved into (null = the personal root, or the
   *  settings default when one is configured). */
  meetingFolderId: string | null;
  setMeetingFolder: (folderId: string | null) => void;
  /**
   * This meeting's org-share choice. null = follow the settings default;
   * "off" = suppress a default share for this one meeting. Independent of the
   * folder above — a shared copy is a second destination, not a move. Per
   * meeting: cleared with the rest of the prep slice.
   */
  meetingOrgShare: MeetingShare;
  setMeetingOrgShare: (share: MeetingShare) => void;
  /** Throw the current prep draft away (folder, context, agenda, negotiation
   *  fields). The ONLY prep-clearing path. */
  resetPrep: () => void;

  // the to-do checklist
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  /** Mark the given checklist item ids as done (used by the AI auto-checker).
   *  Skips items the user locked by hand, and never unchecks. */
  markTodosDone: (ids: string[]) => void;
  /** Replace the checklist outright (classifier pass, or a teleprompter snapshot). */
  setTodos: (todos: TodoItem[]) => void;
  /** Replace the checklist with a template's items (all unchecked). */
  applyTodoTemplate: (items: string[]) => void;
  updateTodoText: (id: string, text: string) => void;
  /** Move an item one step. `dir` is -1 (up) or 1 (down). */
  moveTodo: (id: string, dir: -1 | 1) => void;
  /** Join this item with the next one and drop the next row. */
  mergeTodoWithNext: (id: string) => void;
  /** Load a checklist that was prepared outside the app and open the prep screen. */
  loadPreparedChecklist: (doc: PreparedChecklist) => void;
}

/**
 * Everything the user sets up FOR one meeting, reset as one unit by
 * {@link PrepSlice.resetPrep}. Keeping the list in one place is why "the
 * previous call's setup silently followed you into the next meeting" can't come
 * back: one explicit reset clears the slice wholesale.
 *
 * Deliberately NOT reset on stop: the save pipeline reads `meetingFolderId` off
 * the store asynchronously (see history.saveLiveToHistory).
 */
const CLEARED_PREP_SLICE = {
  meetingFolderId: null,
  meetingOrgShare: null,
  meetingContext: "",
  meetingBatna: "",
  meetingTarget: "",
  meetingFloor: "",
  meetingTitle: "",
  meetingAt: null,
  prepOpen: false,
  todos: [] as TodoItem[],
} satisfies Partial<PrepSlice>;

export const createPrepSlice: SliceCreator<PrepSlice> = (set) => ({
  todos: [],
  meetingTitle: "",
  meetingAt: null,
  prepOpen: false,
  meetingContext: "",
  meetingFolderId: null,
  meetingOrgShare: null,
  meetingBatna: "",
  meetingTarget: "",
  meetingFloor: "",

  setMeetingContext: (text) => set({ meetingContext: text }),
  setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
  setMeetingAt: (meetingAt) => set({ meetingAt }),
  setPrepOpen: (prepOpen) => set({ prepOpen }),
  setMeetingOrgShare: (meetingOrgShare) => set({ meetingOrgShare }),
  setMeetingFolder: (meetingFolderId) => set({ meetingFolderId }),
  resetPrep: () =>
    set((s) => {
      if (isMeetingActive(s.meetingStatus)) return {};
      log.info("store: prep reset");
      return { ...CLEARED_PREP_SLICE };
    }),
  setNegotiationField: (field, value) => set({ [field]: value }),

  addTodo: (text) =>
    set((state) => {
      const t = text.trim();
      if (!t) return {};
      return { todos: [...state.todos, { id: crypto.randomUUID(), text: t, done: false }] };
    }),

  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
              locked: true,
              coverage: (!t.done ? "done" : "open") satisfies TodoCoverage,
              streak: 0,
            }
          : t,
      ),
    })),

  removeTodo: (id) => set((state) => ({ todos: state.todos.filter((t) => t.id !== id) })),

  markTodosDone: (ids) =>
    set((state) => {
      const set_ = new Set(ids);
      return {
        todos: state.todos.map((t) =>
          set_.has(t.id) && !t.locked && !t.done ? { ...t, done: true, coverage: "done" as const } : t,
        ),
      };
    }),

  setTodos: (todos) => set({ todos }),

  applyTodoTemplate: (items) =>
    set({
      todos: items
        .filter((t) => t.trim())
        .map((t) => ({ id: crypto.randomUUID(), text: t.trim(), done: false })),
    }),

  updateTodoText: (id, text) =>
    set((state) => ({
      todos: state.todos.map((t) => {
        if (t.id !== id || text === t.text) return t;
        // Keep spaces while the field is being edited. A hand-locked item
        // keeps its check. An unlocked wording change starts over, because
        // the old score was about different words.
        if (t.locked || text.trim() === t.text.trim()) return { ...t, text };
        return { ...t, text, done: false, coverage: "open", streak: 0 };
      }),
    })),

  moveTodo: (id, dir) =>
    set((state) => {
      const index = state.todos.findIndex((t) => t.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= state.todos.length) return {};
      const todos = state.todos.slice();
      const row = todos[index];
      if (!row) return {};
      todos.splice(index, 1);
      todos.splice(target, 0, row);
      return { todos };
    }),

  mergeTodoWithNext: (id) =>
    set((state) => {
      const index = state.todos.findIndex((t) => t.id === id);
      if (index < 0 || index === state.todos.length - 1) return {};
      const current = state.todos[index];
      const next = state.todos[index + 1];
      const done = current.done || next.done;
      const merged: TodoItem = {
        id: current.id,
        text: `${current.text}; ${next.text}`,
        done,
        locked: Boolean(current.locked || next.locked),
        coverage: done ? "done" : current.coverage === "partial" || next.coverage === "partial" ? "partial" : "open",
        streak: 0,
      };
      const todos = state.todos.slice();
      todos.splice(index, 2, merged);
      return { todos };
    }),

  loadPreparedChecklist: (doc) =>
    set((state) => {
      if (isMeetingActive(state.meetingStatus)) return {};
      return {
        appMode: "home",
        prepOpen: true,
        meetingTitle: doc.title,
        meetingAt: doc.meetingTime,
        meetingContext: doc.context.trim() ? doc.context : state.meetingContext,
        todos: doc.items
          .filter((item) => item.trim())
          .map((item) => ({ id: crypto.randomUUID(), text: item.trim(), done: false })),
      };
    }),
});
