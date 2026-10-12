export type SearchKind =
  | "command"
  | "tab"
  | "bookmark"
  | "history"
  | "workspace"
  | "session"
  | "note"
  | "url";
export interface SearchDocument {
  id: string;
  kind: SearchKind;
  title: string;
  detail: string;
  extra?: string;
}
interface Indexed {
  document: SearchDocument;
  fingerprint: string;
  title: string;
  text: string;
}
const prefixes: Record<string, SearchKind> = {
  t: "tab",
  b: "bookmark",
  h: "history",
  w: "workspace",
  s: "session",
  n: "note",
};
export function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function parseSearch(value: string): {
  kind?: SearchKind;
  text: string;
} {
  const match = value.trim().match(/^([tbhwsn]):\s*(.*)$/i);
  if (match && prefixes[match[1]!.toLowerCase()])
    return {
      kind: prefixes[match[1]!.toLowerCase()],
      text: normalizeSearch(match[2]!),
    };
  if (value.trim().startsWith(">"))
    return { kind: "command", text: normalizeSearch(value.trim().slice(1)) };
  return { text: normalizeSearch(value) };
}
function termScore(text: string, term: string): number {
  const index = text.indexOf(term);
  if (index >= 0)
    return (
      80 -
      Math.min(index, 35) +
      (index === 0 || /[\s/._-]/.test(text[index - 1]!) ? 20 : 0)
    );
  let at = -1,
    first = -1;
  for (const char of term) {
    at = text.indexOf(char, at + 1);
    if (at < 0) return -1;
    if (first < 0) first = at;
  }
  return Math.max(1, 25 - (at - first - term.length));
}
/** Keeps normalized content for unchanged IDs; sync also prunes removed entities. */
export class LocalSearchIndex {
  private entries = new Map<string, Indexed>();
  sync(documents: SearchDocument[]) {
    const ids = new Set<string>();
    let changed = 0;
    for (const document of documents) {
      ids.add(document.id);
      const fingerprint = JSON.stringify([
        document.kind,
        document.title,
        document.detail,
        document.extra,
      ]);
      if (this.entries.get(document.id)?.fingerprint === fingerprint) continue;
      this.entries.set(document.id, {
        document,
        fingerprint,
        title: normalizeSearch(document.title),
        text: normalizeSearch(
          `${document.title} ${document.detail} ${document.extra ?? ""}`,
        ),
      });
      changed++;
    }
    for (const id of this.entries.keys())
      if (!ids.has(id)) this.entries.delete(id);
    return changed;
  }
  search(query: string, recent: string[] = []) {
    const { kind, text } = parseSearch(query);
    const terms = text.split(" ").filter(Boolean);
    return [...this.entries.values()]
      .filter((entry) => !kind || entry.document.kind === kind)
      .map((entry) => {
        let score = 0;
        for (const term of terms) {
          const match = termScore(entry.text, term);
          if (match < 0) return { entry, score: -1 };
          score += match + (entry.title.includes(term) ? 40 : 0);
        }
        if (text && entry.title === text) score += 200;
        if (!text) {
          const position = recent.indexOf(entry.document.id);
          score +=
            position >= 0
              ? 1000 - position
              : entry.document.kind === "command"
                ? 100
                : 0;
        }
        return { entry, score };
      })
      .filter(({ score }) => score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.entry.document.title.localeCompare(b.entry.document.title) ||
          a.entry.document.id.localeCompare(b.entry.document.id),
      )
      .map(({ entry }) => entry.document);
  }
}
export function validCommandHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" && id.length > 0 && id.length <= 240,
      ),
    ),
  ].slice(0, 20);
}
