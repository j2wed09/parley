import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../../i18n";
import { isTauri } from "../../lib/tauriEvents";
import { log } from "../../lib/log";
import { useStore } from "../../lib/store";
import { parsePreparedChecklist, type PreparedChecklist } from "../../lib/checklist/parse";
import * as ipc from "../../lib/ipc/commands";

interface Row {
  name: string;
  checklist?: PreparedChecklist;
  error?: string;
}

const DEMO: Row[] = [
  {
    name: "acme.json",
    checklist: {
      title: "Acme renewal",
      meetingTime: "Thursday 3:00 PM",
      context: "Dana owns the account.",
      items: ["Confirm who owns the budget", "Ask what success looks like in 90 days", "Agree a follow-up date"],
    },
  },
  {
    name: "interview.md",
    checklist: {
      title: "Staff engineer interview",
      meetingTime: null,
      context: "",
      items: ["Walk through the migration", "Ask about the on-call rotation"],
    },
  },
];

/**
 * Checklists an assistant dropped in ~/Parley/checklists. Opening one loads it
 * onto the prep screen and moves the file into `applied/` so it leaves this list.
 */
export function PreparedChecklists() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [folder, setFolder] = useState("~/Parley/checklists");
  const demo = import.meta.env.DEV && (globalThis.location?.hash ?? "").includes("demo=1");

  useEffect(() => {
    if (!isTauri()) {
      if (demo) setRows(DEMO);
      return;
    }
    let stop = false;
    const load = () => {
      ipc
        .checklistFolder()
        .then((path) => {
          if (!stop && path) setFolder(path);
        })
        .catch((error: unknown) => log.warn("checklist: folder lookup failed", { error: String(error) }));
      ipc
        .listPreparedChecklists()
        .then((files) => {
          if (stop) return;
          setRows(
            files.map((file) => {
              if (file.error) return { name: file.name, error: file.error };
              try {
                return { name: file.name, checklist: parsePreparedChecklist(file.name, file.body) };
              } catch (error) {
                return { name: file.name, error: error instanceof Error ? error.message : String(error) };
              }
            }),
          );
        })
        .catch((error: unknown) => log.warn("checklist: list failed", { error: String(error) }));
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [demo]);

  if (rows.length === 0 && !isTauri() && !demo) return null;

  function open(row: Row) {
    if (!row.checklist) return;
    const meetingActive = useStore.getState().meetingStatus === "recording" || useStore.getState().meetingStatus === "paused";
    if (meetingActive) {
      toast.error(t("home.prepared.busy"));
      return;
    }
    useStore.getState().loadPreparedChecklist(row.checklist);
    if (!isTauri()) return;
    void ipc.consumePreparedChecklist({ name: row.name }).catch((error: unknown) => {
      log.warn("checklist: could not file the checklist away", { error: String(error) });
    });
  }

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground">{t("home.prepared.title")}</h2>
      <p className="text-xs text-muted-foreground">{t("home.prepared.folder", { folder })}</p>
      {rows.length === 0 ? null : (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center gap-2.5 px-2 py-2.5">
              <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
              {row.checklist ? (
                <button type="button" onClick={() => open(row)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{row.checklist.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.checklist.meetingTime ? `${row.checklist.meetingTime} · ` : ""}
                      {t("home.prepared.items", { count: row.checklist.items.length })}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary">{t("home.prepared.open")}</span>
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {t("home.prepared.invalid", { name: row.name })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
