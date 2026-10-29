/** A checklist prepared outside the app and dropped in ~/Parley/checklists. */
export interface PreparedChecklist {
  title: string;
  /** ISO-8601 or any clock time the author wrote. Display only. */
  meetingTime: string | null;
  context: string;
  items: string[];
}

/**
 * Parse a `.json` or `.md` checklist file.
 *
 * JSON:
 * `{ "title", "meetingTime"?, "context"?, "items": ["..."] }`
 * An item may also be `{ "text": "..." }`.
 *
 * Markdown: optional `---` front matter (`title`, `meetingTime`, `context`),
 * a leading `# title`, then `-` / `*` / `1.` lines for the items. Other lines
 * become the context when front matter did not set one.
 */
export function parsePreparedChecklist(name: string, body: string): PreparedChecklist {
  const text = body.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error(`No checklist items in ${name}.`);
  const parsed = name.toLowerCase().endsWith(".json") ? parseJsonChecklist(text) : parseMarkdownChecklist(text);
  const items = parsed.items.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) throw new Error(`No checklist items in ${name}.`);
  const title = parsed.title.trim() || titleFromName(name);
  return {
    title,
    meetingTime: parsed.meetingTime?.trim() || null,
    context: parsed.context.trim(),
    items,
  };
}

function titleFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base || name;
}

function parseJsonChecklist(text: string): { title: string; meetingTime: string; context: string; items: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Checklist JSON could not be parsed.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Checklist JSON must be an object.");
  }
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items) ? record.items.map(itemText).filter(Boolean) : [];
  return {
    title: stringField(record, "title") || stringField(record, "name"),
    meetingTime: stringField(record, "meetingTime") || stringField(record, "meeting_time") || stringField(record, "time"),
    context: stringField(record, "context"),
    items,
  };
}

function parseMarkdownChecklist(text: string): { title: string; meetingTime: string; context: string; items: string[] } {
  let body = text;
  let title = "";
  let meetingTime = "";
  let context = "";
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end !== -1) {
      const front = body.slice(3, end).split("\n");
      body = body.slice(end + 4).replace(/^\n/, "");
      for (const line of front) {
        const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
        if (!match) continue;
        const key = match[1].toLowerCase();
        const value = unquote(match[2].trim());
        if (key === "title" || key === "name") title = value;
        else if (key === "meetingtime" || key === "meeting_time" || key === "time") meetingTime = value;
        else if (key === "context") context = value;
      }
    }
  }

  const items: string[] = [];
  const prose: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (!title) title = heading[1].trim();
      continue;
    }
    const bullet = trimmed.match(/^(?:[-*]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      items.push(bullet[1].trim());
      continue;
    }
    prose.push(trimmed);
  }
  if (!context && prose.length > 0) context = prose.join("\n");
  return { title, meetingTime, context, items };
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function itemText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (!entry || typeof entry !== "object" || !("text" in entry)) return "";
  const text = entry.text;
  return typeof text === "string" ? text.trim() : "";
}

function unquote(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}
