import { useStore } from "./store";
import { isTauri } from "./tauriEvents";
import { emitEvent, listenIfTauri, type UnlistenFn } from "./ipc/events";
import type { MeetingStatus, TodoItem } from "./types";

/** Main window → teleprompter. The main window is the source of truth. */
export const TELEPROMPTER_STATE = "teleprompter://state";
/** Teleprompter → main window. A click, applied as a manual toggle. */
export const TELEPROMPTER_TOGGLE = "teleprompter://toggle";
/** Teleprompter → main window, once its listener is attached, so the first
 *  snapshot is not sent into an empty room. */
export const TELEPROMPTER_READY = "teleprompter://ready";

export interface TeleprompterSnapshot {
  todos: TodoItem[];
  title: string;
  meetingAt: string | null;
  meetingStatus: MeetingStatus;
}

function snapshot(): TeleprompterSnapshot {
  const state = useStore.getState();
  return {
    todos: state.todos,
    title: state.meetingTitle,
    meetingAt: state.meetingAt,
    meetingStatus: state.meetingStatus,
  };
}

/**
 * Installed once, by the main window. Pushes the checklist whenever it
 * changes, and applies check/uncheck clicks from the teleprompter as manual
 * toggles (so the classifier will not undo them).
 */
export function installTeleprompterHost(): () => void {
  if (!isTauri()) return () => {};
  const send = () => {
    void emitEvent(TELEPROMPTER_STATE, snapshot());
  };
  send();
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (
      state.todos !== previous.todos ||
      state.meetingTitle !== previous.meetingTitle ||
      state.meetingAt !== previous.meetingAt ||
      state.meetingStatus !== previous.meetingStatus
    ) {
      send();
    }
  });
  const stops: UnlistenFn[] = [];
  let disposed = false;
  const track = (subscription: Promise<UnlistenFn>) => {
    void subscription.then((stop) => {
      if (disposed) stop();
      else stops.push(stop);
    });
  };
  track(
    listenIfTauri<{ id?: string }>(TELEPROMPTER_TOGGLE, (event) => {
      const id = event.payload?.id;
      if (typeof id === "string") useStore.getState().toggleTodo(id);
    }),
  );
  track(listenIfTauri(TELEPROMPTER_READY, () => send()));
  return () => {
    disposed = true;
    unsubscribe();
    for (const stop of stops) stop();
  };
}
