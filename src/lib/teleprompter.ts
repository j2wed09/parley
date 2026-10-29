import { isTauri } from "./tauriEvents";
import { log } from "./log";

const LABEL = "teleprompter";

/**
 * Open the compact always-on-top checklist. Content protection hides it from
 * many screen-share capture paths; see the README for the macOS caveat.
 * Outside Tauri (browser dev) the same view opens in a small window.
 */
export async function openTeleprompter(): Promise<void> {
  if (!isTauri()) {
    globalThis.open("index.html#teleprompter", LABEL, "popup,width=380,height=560");
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    await existing.show();
    await existing.unminimize();
    await existing.setAlwaysOnTop(true);
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow(LABEL, {
    url: "index.html#teleprompter",
    title: "Teleprompter",
    width: 380,
    height: 560,
    minWidth: 280,
    minHeight: 240,
    resizable: true,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    contentProtected: true,
    focus: true,
  });
  win.once("tauri://error", (event) => log.error("teleprompter: window error", { error: String(event) }));
  win.once("tauri://created", () => {
    void protect(win);
  });
}

async function protect(win: import("@tauri-apps/api/webviewWindow").WebviewWindow): Promise<void> {
  await win.setAlwaysOnTop(true).catch((error: unknown) => {
    log.warn("teleprompter: always-on-top failed", { error: String(error) });
  });
  await win.setVisibleOnAllWorkspaces(true).catch((error: unknown) => {
    log.warn("teleprompter: all-spaces failed", { error: String(error) });
  });
  await win.setContentProtected(true).catch((error: unknown) => {
    log.warn("teleprompter: content protection failed", { error: String(error) });
  });
}
