import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useI18n } from "../i18n";
import { isTauri } from "../lib/tauriEvents";
import { log } from "../lib/log";
import * as ipc from "../lib/ipc/commands";
import { Field } from "./fields";

/** The TypeSafe key. It is sent to Rust once and never stored in the webview. */
export function TypesafeKeyField() {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    ipc
      .typesafeKeyConfigured()
      .then((set) => {
        if (active) setConfigured(set);
      })
      .catch((error: unknown) => log.warn("typesafe: status failed", { error: String(error) }));
    return () => {
      active = false;
    };
  }, []);

  if (!isTauri()) {
    return (
      <Field label={t("settings.todos.typesafeKey")}>
        <p className="text-[11px] text-muted-foreground">{t("settings.todos.typesafeKey.desktop")}</p>
      </Field>
    );
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await ipc.setTypesafeApiKey({ key: draft });
      setDraft("");
      setConfigured(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setMessage("");
    try {
      await ipc.clearTypesafeApiKey();
      setConfigured(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={t("settings.todos.typesafeKey")}>
      <div className="flex items-center gap-2">
        <PasswordInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("settings.todos.typesafeKey.placeholder")}
          className="max-w-sm"
          autoComplete="off"
        />
        <Button type="button" size="sm" className="h-8" disabled={busy || !draft.trim()} onClick={() => void save()}>
          {t("settings.todos.typesafeKey.save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8" disabled={busy || !configured} onClick={() => void clear()}>
          {t("settings.todos.typesafeKey.clear")}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {configured ? t("settings.todos.typesafeKey.saved") : t("settings.todos.typesafeKey.missing")}
      </p>
      <p className="max-w-sm text-[11px] text-muted-foreground">{t("settings.todos.typesafeKey.help")}</p>
      {message && <p className="text-[11px] text-destructive">{message}</p>}
    </Field>
  );
}
