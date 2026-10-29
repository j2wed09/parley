import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChecklistGenerator, TodoChecker, TodoTemplate } from "../../lib/types";
import { JEV_MODEL } from "../../lib/checklist/jev";
import { useI18n } from "../../i18n";
import { isTauri } from "../../lib/tauriEvents";
import * as ipc from "../../lib/ipc/commands";
import { Field, Section } from "../fields";
import { TypesafeKeyField } from "../TypesafeKeyField";
import type { SettingsPanelProps } from "./types";

/** Settings › To-dos: how a checklist is built, how it checks off, and the templates. */
export function TodosCategory({ settings, patch }: Readonly<SettingsPanelProps>) {
  const { t } = useI18n();
  const [folder, setFolder] = useState("~/Parley/checklists");
  useEffect(() => {
    if (!isTauri()) return;
    ipc.checklistFolder().then(setFolder).catch(() => {});
  }, []);
  return (
    <Section title={t("settings.todos.title")}>
      <p className="text-[11px] text-muted-foreground">
        {t("settings.todos.help")}
      </p>
      <Field label={t("settings.todos.generator")}>
        <select
          value={settings.checklistGenerator}
          onChange={(event) => patch({ checklistGenerator: event.target.value as ChecklistGenerator })}
          className="h-8 max-w-sm rounded-lg border bg-transparent px-2 text-sm"
        >
          <option value="claude-cli">{t("settings.todos.generator.claude")}</option>
          <option value="provider">{t("settings.todos.generator.provider")}</option>
        </select>
        <p className="max-w-sm text-[11px] text-muted-foreground">{t("settings.todos.generator.help")}</p>
      </Field>
      <Field label={t("settings.todos.checker")}>
        <select
          value={settings.todoChecker}
          onChange={(event) => patch({ todoChecker: event.target.value as TodoChecker })}
          className="h-8 max-w-sm rounded-lg border bg-transparent px-2 text-sm"
        >
          <option value="jev">{t("settings.todos.checker.jev")}</option>
          <option value="llm">{t("settings.todos.checker.llm")}</option>
        </select>
        <p className="max-w-sm text-[11px] text-muted-foreground">{t("settings.todos.checker.help")}</p>
      </Field>
      <Field label={t("settings.todos.model")}>
        <Input
          value={settings.jevModel}
          onChange={(event) => patch({ jevModel: event.target.value })}
          onBlur={(event) => patch({ jevModel: event.target.value.trim() || JEV_MODEL })}
          className="h-8 max-w-sm font-mono text-xs"
          spellCheck={false}
        />
        <p className="max-w-sm text-[11px] text-muted-foreground">{t("settings.todos.model.help")}</p>
      </Field>
      <TypesafeKeyField />
      <div className="flex flex-wrap gap-4">
        <Field label={t("settings.todos.doneThreshold")}>
          <Input
            type="number"
            min={0.05}
            max={0.99}
            step={0.05}
            value={settings.jevDoneThreshold}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) patch({ jevDoneThreshold: value });
            }}
            className="h-8 w-24"
          />
        </Field>
        <Field label={t("settings.todos.partialThreshold")}>
          <Input
            type="number"
            min={0.05}
            max={0.99}
            step={0.05}
            value={settings.jevPartialThreshold}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) patch({ jevPartialThreshold: value });
            }}
            className="h-8 w-24"
          />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.jevRequireConsecutive}
          onChange={(event) => patch({ jevRequireConsecutive: event.target.checked })}
        />
        <span>{t("settings.todos.consecutive")}</span>
      </label>
      <p className="text-[11px] text-muted-foreground">{t("settings.todos.folder", { folder })}</p>
      <div className="flex flex-col gap-4">
        {settings.todoTemplates.map((tpl) => (
          <TodoTemplateEditor
            key={tpl.id}
            tpl={tpl}
            onChange={(p) => patch({ todoTemplates: settings.todoTemplates.map((x) => (x.id === tpl.id ? { ...x, ...p } : x)) })}
            onDelete={() => patch({ todoTemplates: settings.todoTemplates.filter((x) => x.id !== tpl.id) })}
          />
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          patch({
            todoTemplates: [
              ...settings.todoTemplates,
              { id: crypto.randomUUID(), name: t("settings.todos.defaultNewName"), items: [""] },
            ],
          })
        }
      >
        <Plus className="size-3.5" /> {t("settings.todos.addTemplate")}
      </Button>
    </Section>
  );
}

function TodoTemplateEditor({
  tpl,
  onChange,
  onDelete,
}: Readonly<{
  tpl: TodoTemplate;
  onChange: (p: Partial<TodoTemplate>) => void;
  onDelete: () => void;
}>) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Input value={tpl.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={t("settings.todos.templateName")} className="h-8 font-medium" />
        <span className="shrink-0 text-[10px] text-muted-foreground">{tpl.builtin ? t("common.builtin") : t("common.custom")}</span>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {tpl.items.map((it, i) => (
          <div
            key={`${tpl.id}-${it}-${tpl.items.slice(0, i + 1).filter((item) => item === it).length}`}
            className="flex items-center gap-2"
          >
            <Input
              value={it}
              onChange={(e) => onChange({ items: tpl.items.map((x, j) => (j === i ? e.target.value : x)) })}
              placeholder={t("settings.todos.itemPlaceholder")}
              className="h-8 text-xs"
            />
            <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onChange({ items: tpl.items.filter((_, j) => j !== i) })}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="w-fit text-[11px]" onClick={() => onChange({ items: [...tpl.items, ""] })}>
        <Plus className="size-3.5" /> {t("settings.todos.addItem")}
      </Button>
    </div>
  );
}
