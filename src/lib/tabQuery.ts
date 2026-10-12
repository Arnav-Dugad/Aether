import {
  domain,
  duplicateGroups,
  type Config,
  type TabMeta,
  type Workspace,
} from "./model";
import { metadataKey } from "./tabActions";
export function queryTabs(
  tabs: chrome.tabs.Tab[],
  metadata: TabMeta[],
  options: {
    query: string;
    filter: string;
    sort: Config["tabSort"];
    windowId: number | null;
    workspaceId: string | null;
    assignments: Record<string, string>;
    workspaces: Workspace[];
  },
): chrome.tabs.Tab[] {
  const meta = new Map(metadata.map((row) => [row.url, row]));
  const duplicateIds =
    options.filter === "duplicates"
      ? new Set(
          duplicateGroups(tabs)
            .flat()
            .map((t) => t.id),
        )
      : null;
  const active = new Set(
    options.workspaces
      .filter((w) => !w.archived && !w.template)
      .map((w) => w.id),
  );
  const words = options.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = tabs.filter((tab) => {
    const row = meta.get(metadataKey(tab.url) ?? "");
    const assignment = options.assignments[String(tab.id)];
    return (
      words.every((word) =>
        `${row?.label ?? ""} ${tab.title ?? ""} ${tab.url ?? ""}`
          .toLowerCase()
          .includes(word),
      ) &&
      (options.windowId === null || tab.windowId === options.windowId) &&
      (options.workspaceId === null ||
        (options.workspaceId === "unassigned"
          ? !assignment || !active.has(assignment)
          : assignment === options.workspaceId)) &&
      (options.filter !== "pinned" || tab.pinned) &&
      (options.filter !== "favorites" || row?.favorite) &&
      (options.filter !== "protected" || row?.protected) &&
      (options.filter !== "duplicates" || duplicateIds?.has(tab.id))
    );
  });
  if (options.sort === "title")
    result.sort((a, b) =>
      (
        meta.get(metadataKey(a.url) ?? "")?.label ||
        a.title ||
        ""
      ).localeCompare(
        meta.get(metadataKey(b.url) ?? "")?.label || b.title || "",
      ),
    );
  else if (options.sort === "domain")
    result.sort(
      (a, b) =>
        domain(a.url ?? "").localeCompare(domain(b.url ?? "")) ||
        a.index - b.index,
    );
  else if (options.sort === "recent")
    result.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  else result.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  return result;
}
export function groupedTabRows(
  tabs: chrome.tabs.Tab[],
  mode: "domains" | "windows",
): (
  | { kind: "heading"; name: string; count: number }
  | { kind: "tab"; tab: chrome.tabs.Tab }
)[] {
  const groups = new Map<string, chrome.tabs.Tab[]>();
  const windows = [...new Set(tabs.map((t) => t.windowId))];
  for (const tab of tabs) {
    const key =
      mode === "domains"
        ? domain(tab.url ?? "")
        : `Window ${windows.indexOf(tab.windowId) + 1}`;
    groups.set(key, [...(groups.get(key) ?? []), tab]);
  }
  return [...groups].flatMap(([name, members]) => [
    { kind: "heading" as const, name, count: members.length },
    ...members.map((tab) => ({ kind: "tab" as const, tab })),
  ]);
}
