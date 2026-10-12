import { useEffect, useRef, useState } from "react";
import {
  Search,
  Command,
  ArrowUpRight,
  Layers,
  Archive,
  Settings,
  Moon,
  NotebookPen,
  Briefcase,
  BarChart3,
  Bookmark,
  History,
  Globe,
} from "lucide-react";
import { Modal } from "./ui";
import { activateTab, saveSession, openUrl, installed } from "../lib/browser";
import { metadataKey } from "../lib/tabActions";
import { safeUrl } from "../lib/model";
import {
  LocalSearchIndex,
  validCommandHistory,
  type SearchDocument,
  type SearchKind,
} from "../lib/searchIndex";
import type { FeatureProps } from "../features/types";
import "./command-search.css";
const icons = {
  command: Command,
  tab: ArrowUpRight,
  bookmark: Bookmark,
  history: History,
  workspace: Briefcase,
  session: Archive,
  note: NotebookPen,
  url: Globe,
};
const labels: Record<SearchKind, string> = {
  command: "Command",
  tab: "Open tab",
  bookmark: "Bookmark",
  history: "History",
  workspace: "Workspace",
  session: "Session",
  note: "Note",
  url: "Web address",
};
export function CommandPalette({
  a,
  run,
  navigate,
  onClose,
}: FeatureProps & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [optional, setOptional] = useState<SearchDocument[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(installed);
  const [sourcesError, setSourcesError] = useState("");
  const index = useRef(new LocalSearchIndex());
  useEffect(() => {
    if (!installed) return;
    let cancelled = false;
    void chrome.storage.local
      .get("commandHistory")
      .then((data) => {
        if (!cancelled) setRecent(validCommandHistory(data.commandHistory));
      })
      .catch(() => {});
    async function load() {
      const documents: SearchDocument[] = [];
      const outcomes = await Promise.allSettled([
        (async () => {
          if (
            !(await chrome.permissions.contains({ permissions: ["bookmarks"] }))
          )
            return;
          const tree = await chrome.bookmarks.getTree();
          function visit(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
            for (const node of nodes) {
              if (node.url && safeUrl(node.url))
                documents.push({
                  id: `bookmark:${node.id}`,
                  kind: "bookmark",
                  title: node.title || node.url,
                  detail: node.url,
                });
              if (node.children) visit(node.children);
            }
          }
          visit(tree);
        })(),
        (async () => {
          if (
            !(await chrome.permissions.contains({ permissions: ["history"] }))
          )
            return;
          const history = await chrome.history.search({
            text: "",
            startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
            maxResults: 500,
          });
          for (const row of history)
            if (row.url && safeUrl(row.url))
              documents.push({
                id: `history:${row.id}`,
                kind: "history",
                title: row.title || row.url,
                detail: row.url,
              });
        })(),
      ]);
      if (!cancelled) {
        setOptional(documents);
        setLoading(false);
        if (outcomes.some((outcome) => outcome.status === "rejected"))
          setSourcesError(
            "Some browser sources could not be loaded. Other results are available.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  const commandEntries = [
    {
      id: "command:tabs",
      title: "Manage tabs",
      detail: "Go to tabs",
      icon: Layers,
      action: () => navigate?.("tabs"),
    },
    {
      id: "command:workspaces",
      title: "Open workspaces",
      detail: "Saved spaces",
      icon: Briefcase,
      action: () => navigate?.("workspaces"),
    },
    {
      id: "command:save",
      title: "Save current session",
      detail: "Save all regular web tabs",
      icon: Archive,
      action: () =>
        run(
          () => saveSession(`Session · ${new Date().toLocaleDateString()}`),
          "Session saved",
        ),
    },
    {
      id: "command:notes",
      title: "Capture a note",
      detail: "Open notes",
      icon: NotebookPen,
      action: () => navigate?.("notes"),
    },
    {
      id: "command:focus",
      title: "Focus timer",
      detail: "Make room for deep work",
      icon: Moon,
      action: () => navigate?.("focus"),
    },
    {
      id: "command:analytics",
      title: "Activity insights",
      detail: "Real local activity",
      icon: BarChart3,
      action: () => navigate?.("analytics"),
    },
    {
      id: "command:settings",
      title: "Appearance & settings",
      detail: "Make Aether yours",
      icon: Settings,
      action: () => navigate?.("settings"),
    },
    {
      id: "command:sessions",
      title: "Open sessions",
      detail: "Review saved snapshots",
      icon: Archive,
      action: () => navigate?.("sessions"),
    },
  ];
  const meta = new Map(a.tabMeta.map((row) => [row.url, row]));
  const documents: SearchDocument[] = [
    ...commandEntries.map((item) => ({
      id: item.id,
      kind: "command" as const,
      title: item.title,
      detail: item.detail,
    })),
    ...a.tabs
      .filter((tab) => tab.id !== undefined && !tab.incognito)
      .map((tab) => {
        const info = meta.get(metadataKey(tab.url) ?? "");
        return {
          id: `tab:${tab.id}`,
          kind: "tab" as const,
          title: tab.title || "Untitled tab",
          detail: `${info?.favorite ? "Favorite · " : ""}${info?.label ? `${info.label} · ` : ""}${tab.url ?? "Open tab"}`,
          extra: info?.favorite ? "favorite starred" : "",
        };
      }),
    ...a.workspaces
      .filter((row) => !row.archived && !row.template)
      .map((row) => ({
        id: `workspace:${row.id}`,
        kind: "workspace" as const,
        title: row.name,
        detail: `${row.tabs.length} saved pages · ${row.description}`,
        extra: row.tabs.map((tab) => tab.url).join(" "),
      })),
    ...a.sessions.map((row) => ({
      id: `session:${row.id}`,
      kind: "session" as const,
      title: row.name,
      detail: `${row.tabs.length} tabs · Review before restoring`,
      extra: row.tabs.map((tab) => `${tab.title} ${tab.url}`).join(" "),
    })),
    ...a.notes.map((row) => ({
      id: `note:${row.id}`,
      kind: "note" as const,
      title: row.title || "Untitled note",
      detail: row.body.slice(0, 140).replace(/\s+/g, " "),
      extra: `${row.body} ${row.url ?? ""}`,
    })),
    ...optional,
  ];
  index.current.sync(documents);
  const directUrl = safeUrl(query.trim());
  const matches = index.current.search(query, recent);
  const results = (
    directUrl
      ? [
          {
            id: `url:${directUrl}`,
            kind: "url" as const,
            title: "Open web address",
            detail: directUrl,
          },
          ...matches,
        ]
      : matches
  ).slice(0, 80);
  const current = Math.min(active, Math.max(0, results.length - 1));
  const counts = new Map<SearchKind, number>();
  for (const item of matches)
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  function execute(position: number) {
    const item = results[position];
    if (!item) return;
    const nextRecent = validCommandHistory([item.id, ...recent]);
    if (installed)
      void chrome.storage.local
        .set({ commandHistory: nextRecent })
        .catch(() => {});
    if (item.kind === "command")
      commandEntries.find((entry) => entry.id === item.id)?.action();
    else if (item.kind === "tab") {
      const tab = a.tabs.find((tab) => `tab:${tab.id}` === item.id);
      if (tab) run(() => activateTab(tab));
    } else if (item.kind === "workspace") {
      const workspace = a.workspaces.find(
        (row) => `workspace:${row.id}` === item.id,
      );
      if (workspace)
        run(async () => {
          await a.patchConfig({ activeWorkspaceId: workspace.id });
          navigate?.("tabs");
        });
    } else if (item.kind === "session") navigate?.("sessions");
    else if (item.kind === "note") navigate?.("notes");
    else run(() => openUrl(item.detail));
    onClose();
  }
  return (
    <Modal title="Command search" onClose={onClose}>
      <div className="palette-search">
        <Search size={19} />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          placeholder="Search everything, or paste a web address"
          aria-label="Search commands and tabs"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={
            results[current] ? `command-result-${current}` : undefined
          }
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next =
                event.key === "ArrowDown"
                  ? Math.min(current + 1, Math.max(0, results.length - 1))
                  : Math.max(current - 1, 0);
              setActive(next);
              document
                .getElementById(`command-result-${next}`)
                ?.scrollIntoView({ block: "nearest" });
            }
            if (event.key === "Enter") {
              event.preventDefault();
              execute(current);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <p className="command-prefix-help">
        t: tabs · b: bookmarks · h: history · w: workspaces · s: sessions · n:
        notes · &gt; commands
      </p>
      <div className="command-source-counts" role="status">
        {[...counts.entries()].map(([kind, count]) => (
          <span key={kind}>
            {labels[kind]} {count}
          </span>
        ))}
        {loading && <span>Loading permitted browser sources…</span>}
      </div>
      {sourcesError && (
        <p className="command-prefix-help" role="status">
          {sourcesError}
        </p>
      )}
      <div
        className="command-results"
        id="command-results"
        role="listbox"
        aria-label="Commands and tabs"
      >
        {results.map((item, position) => {
          const Icon =
            item.kind === "command"
              ? (commandEntries.find((entry) => entry.id === item.id)?.icon ??
                Command)
              : icons[item.kind];
          return (
            <button
              type="button"
              tabIndex={-1}
              key={item.id}
              id={`command-result-${position}`}
              role="option"
              aria-selected={position === current}
              className={`command-item ${position === current ? "selected" : ""}`}
              onMouseEnter={() => setActive(position)}
              onClick={() => execute(position)}
            >
              <Icon size={18} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="command-result-kind">{labels[item.kind]}</span>
              {position === current && <kbd>↵</kbd>}
            </button>
          );
        })}
        {!results.length && (
          <p className="empty">No results match “{query}”.</p>
        )}
      </div>
      <footer className="palette-footer">
        <span>
          <Command size={13} /> Aether · local search
        </span>
        <span>
          ↑↓ navigate · ↵ open{matches.length > 80 ? " · first 80 results" : ""}
        </span>
      </footer>
    </Modal>
  );
}
