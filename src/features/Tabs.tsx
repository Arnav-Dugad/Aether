import { useState } from "react";
import { Layers, RotateCcw, Copy, Moon, FolderPlus } from "lucide-react";
import { TabList } from "../components/TabList";
import { Panel, Empty, SearchField, Modal } from "../components/ui";
import { installed } from "../lib/browser";
import { domain, duplicateGroups } from "../lib/model";
import type { FeatureProps } from "./types";
export function Tabs({ a, run }: FeatureProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [recent, setRecent] = useState<chrome.sessions.Session[]>([]);
  const [confirm, setConfirm] = useState(false);
  const duplicates = duplicateGroups(a.tabs);
  const ids = new Set(duplicates.flat().map((t) => t.id));
  const filtered = a.tabs.filter(
    (t) =>
      `${t.title} ${t.url}`.toLowerCase().includes(query.toLowerCase()) &&
      (view !== "pinned" || t.pinned) &&
      (view !== "duplicates" || ids.has(t.id)),
  );
  return (
    <>
      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search titles and URLs"
        />
        <div className="segmented">
          {["all", "pinned", "duplicates"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          className="secondary"
          onClick={() =>
            run(async () => {
              if (!installed) return;
              setRecent(
                await chrome.sessions.getRecentlyClosed({ maxResults: 20 }),
              );
            })
          }
        >
          <RotateCcw size={15} />
          Recently closed
        </button>
      </div>
      <Panel
        title={`${filtered.length} tabs`}
        label="LIVE BROWSER DATA"
        action={
          <button
            className="secondary"
            disabled={!duplicates.length}
            onClick={() => setConfirm(true)}
          >
            <Copy size={15} />
            Review duplicates
          </button>
        }
      >
        {filtered.length ? (
          <TabList tabs={filtered} run={run} />
        ) : (
          <Empty icon={<Layers />} title="A little breathing room">
            {installed
              ? "No tabs match this view."
              : "Browser tabs appear when Aether is installed as an extension."}
          </Empty>
        )}
      </Panel>
      {recent.length > 0 && (
        <Panel title="Recently closed">
          {recent.map((session, index) => (
            <button
              className="recent-row"
              key={session.tab?.sessionId ?? session.window?.sessionId ?? index}
              onClick={() =>
                run(
                  () =>
                    chrome.sessions.restore(
                      session.tab?.sessionId ?? session.window?.sessionId,
                    ),
                  "Restored",
                )
              }
            >
              <RotateCcw size={16} />
              {session.tab?.title ??
                `Window · ${session.window?.tabs?.length ?? 0} tabs`}
            </button>
          ))}
        </Panel>
      )}
      {confirm && (
        <Modal title="Review duplicate tabs" onClose={() => setConfirm(false)}>
          <p>
            Keep active and pinned tabs. Close{" "}
            {
              duplicates.flatMap((g) =>
                g
                  .filter((t) => !t.active && !t.pinned)
                  .slice(g.some((t) => t.active || t.pinned) ? 0 : 1),
              ).length
            }{" "}
            extra copies of matching URLs. URL fragments are ignored.
          </p>
          <div className="dialog-list">
            {duplicates.map((g) => (
              <p key={g[0]!.url}>
                {domain(g[0]!.url!)} <small>· {g.length} copies</small>
              </p>
            ))}
          </div>
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                const close = duplicates
                  .flatMap((g) =>
                    g
                      .filter((t) => !t.active && !t.pinned)
                      .slice(g.some((t) => t.active || t.pinned) ? 0 : 1),
                  )
                  .map((t) => t.id!);
                if (close.length) await chrome.tabs.remove(close);
                setConfirm(false);
              }, "Duplicates closed. Use Recently closed to recover.")
            }
          >
            Close extra copies
          </button>
        </Modal>
      )}
    </>
  );
}
export function Performance({ a, run }: FeatureProps) {
  const candidates = a.tabs.filter(
    (t) =>
      !t.active &&
      !t.pinned &&
      !t.audible &&
      !t.discarded &&
      !t.incognito &&
      !t.url?.startsWith("chrome") &&
      t.autoDiscardable !== false,
  );
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="stats-grid">
        <Panel>
          <span className="eyebrow">OPEN TABS</span>
          <strong className="metric">{a.tabs.length}</strong>
        </Panel>
        <Panel>
          <span className="eyebrow">DISCARDED</span>
          <strong className="metric">
            {a.tabs.filter((t) => t.discarded).length}
          </strong>
        </Panel>
        <Panel>
          <span className="eyebrow">PLAYING AUDIO</span>
          <strong className="metric">
            {a.tabs.filter((t) => t.audible).length}
          </strong>
        </Panel>
      </div>
      <Panel title="Give your browser some room" label="MANUAL TAB DISCARD">
        <p className="muted">
          Discarding unloads a page until you visit it again. Active, pinned,
          audible, and browser-protected tabs are excluded. Save unfinished work
          first; the browser does not expose every form or download state.
        </p>
        <button
          className="secondary"
          disabled={!candidates.length}
          onClick={() => setConfirm(true)}
        >
          <Moon size={16} />
          Review {candidates.length} background tabs
        </button>
      </Panel>
      <Panel title="Measurements, with boundaries">
        <p className="muted">
          Per-tab CPU, GPU, energy, and RAM are not available through the
          standard extension APIs. Aether does not estimate RAM savings.
        </p>
      </Panel>
      {confirm && (
        <Modal
          title="Discard background tabs?"
          onClose={() => setConfirm(false)}
        >
          <p>
            {candidates.length} tabs can be unloaded. Unsaved page content may
            be lost.
          </p>
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                let count = 0;
                for (const candidate of candidates) {
                  const fresh = await chrome.tabs.get(candidate.id!);
                  if (
                    !fresh.active &&
                    !fresh.pinned &&
                    !fresh.audible &&
                    !fresh.discarded &&
                    fresh.autoDiscardable !== false
                  ) {
                    await chrome.tabs.discard(fresh.id!);
                    count++;
                  }
                }
                setConfirm(false);
                return count;
              }, "Background tabs discarded")
            }
          >
            Discard reviewed tabs
          </button>
        </Modal>
      )}
    </>
  );
}
export function Suggestions({ a, run }: FeatureProps) {
  const duplicates = duplicateGroups(a.tabs);
  const groups = new Map<string, chrome.tabs.Tab[]>();
  for (const tab of a.tabs) {
    const key = domain(tab.url ?? "");
    if (key === "Browser page") continue;
    groups.set(key, [...(groups.get(key) ?? []), tab]);
  }
  const suggested = [...groups.entries()].filter(
    ([, tabs]) => tabs.length >= 3,
  );
  return (
    <Panel
      title="Organization suggestions"
      label="EXPLAINABLE · USER INITIATED"
    >
      <p className="muted">
        {duplicates.length} sets of duplicate URLs. Grouping suggestions use
        matching domains; nothing runs automatically.
      </p>
      {suggested.length ? (
        suggested.map(([host, tabs]) => (
          <div className="setting-row" key={host}>
            <span>
              <strong>{host}</strong>
              <small>
                {tabs.length} tabs share this domain. Groups are created
                separately in each window.
              </small>
            </span>
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  if (!chrome.tabs.group || !chrome.tabGroups)
                    throw new Error(
                      "Native groups are unavailable in this browser.",
                    );
                  const windows = [...new Set(tabs.map((t) => t.windowId))];
                  for (const windowId of windows) {
                    const ids = tabs
                      .filter((t) => t.windowId === windowId && !t.pinned)
                      .map((t) => t.id!);
                    if (ids.length < 2) continue;
                    const groupId = await chrome.tabs.group({
                      tabIds: ids as [number, ...number[]],
                    });
                    await chrome.tabGroups.update(groupId, { title: host });
                  }
                }, "Tabs grouped")
              }
            >
              <FolderPlus size={15} />
              Group
            </button>
          </div>
        ))
      ) : (
        <Empty title="Your tabs are already quiet">
          Suggestions appear when at least three tabs share a domain.
        </Empty>
      )}
    </Panel>
  );
}
