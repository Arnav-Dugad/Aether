import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  RotateCcw,
  Copy,
  Pin,
  X,
  MoveRight,
  FolderPlus,
  Briefcase,
  Moon,
  Undo2,
  List,
  Grid2X2,
  Globe,
  PanelsTopLeft,
} from "lucide-react";
import { TabRow } from "../components/TabList";
import { VirtualList } from "../components/VirtualList";
import { Panel, Empty, SearchField, Modal, Field } from "../components/ui";
import { installed } from "../lib/browser";
import { domain, duplicateGroups, type Config } from "../lib/model";
import {
  metadataKey,
  eligibleTabs,
  closeCandidates,
  discardCandidates,
  performTabAction,
  updateTabMeta,
  type TabAction,
} from "../lib/tabActions";
import { queryTabs, groupedTabRows } from "../lib/tabQuery";
import type { FeatureProps } from "./types";
import "./tabs.css";
type BulkDialog =
  | "close"
  | "move"
  | "group"
  | "assign"
  | "discard"
  | "duplicates"
  | null;
export function Tabs({ a, run }: FeatureProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [windowId, setWindowId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [recent, setRecent] = useState<chrome.sessions.Session[]>([]);
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const [result, setResult] = useState<{
    message: string;
    failed: boolean;
  } | null>(null);
  const [destination, setDestination] = useState("new");
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState<
    "blue" | "purple" | "green" | "red" | "yellow" | "grey"
  >("blue");
  const [workspace, setWorkspace] = useState("");
  const [includePinned, setIncludePinned] = useState(false);
  const [includeActive, setIncludeActive] = useState(false);
  const [includeAudible, setIncludeAudible] = useState(false);
  const [edit, setEdit] = useState<chrome.tabs.Tab | null>(null);
  const [label, setLabel] = useState("");
  const [columns, setColumns] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);
  const meta = useMemo(
    () => new Map(a.tabMeta.map((row) => [row.url, row])),
    [a.tabMeta],
  );
  const windows = useMemo(
    () => [...new Set(a.tabs.map((t) => t.windowId))],
    [a.tabs],
  );
  const activeSpaces = a.workspaces.filter((w) => !w.archived && !w.template);
  const context =
    a.config.activeWorkspaceId === "unassigned" ||
    activeSpaces.some((w) => w.id === a.config.activeWorkspaceId)
      ? a.config.activeWorkspaceId
      : null;
  const filtered = useMemo(
    () =>
      queryTabs(a.tabs, a.tabMeta, {
        query,
        filter,
        sort: a.config.tabSort,
        windowId,
        workspaceId: context,
        assignments: a.tabAssignments,
        workspaces: a.workspaces,
      }),
    [
      a.tabs,
      a.tabMeta,
      query,
      filter,
      a.config.tabSort,
      windowId,
      context,
      a.tabAssignments,
      a.workspaces,
    ],
  );
  const selectedTabs = a.tabs.filter(
    (t) => t.id !== undefined && selected.has(t.id),
  );
  const validSelected = eligibleTabs(selectedTabs);
  const selectable = eligibleTabs(filtered);
  const allSelected =
    selectable.length > 0 && selectable.every((t) => selected.has(t.id!));
  useEffect(() => {
    const current = new Set(a.tabs.map((t) => t.id));
    setSelected((existing) => {
      const next = new Set([...existing].filter((id) => current.has(id)));
      return next.size === existing.size ? existing : next;
    });
  }, [a.tabs]);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setColumns(Math.max(1, Math.floor(el.clientWidth / 290))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [a.config.tabView]);
  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function execute(action: TabAction) {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    setResult(null);
    run(async () => {
      try {
        const response = await performTabAction(action);
        setResult({ message: response.message, failed: response.failed > 0 });
        setDialog(null);
        if (action.kind === "close" || action.kind === "discard")
          setSelected(new Set());
      } finally {
        lock.current = false;
        setWorking(false);
      }
    });
  }
  function patch(value: Partial<Config>) {
    run(() => a.patchConfig(value));
  }
  function row(tab: chrome.tabs.Tab, card = false) {
    return (
      <TabRow
        tab={tab}
        run={run}
        card={card}
        selected={selected.has(tab.id!)}
        onToggle={toggle}
        metadata={meta.get(metadataKey(tab.url) ?? "")}
        onEdit={(tab) => {
          setEdit(tab);
          setLabel(meta.get(metadataKey(tab.url) ?? "")?.label ?? "");
        }}
      />
    );
  }
  const closeOptions = { includePinned, includeActive, includeAudible };
  const duplicateCandidates = duplicateGroups(a.tabs).flatMap((group) => {
    const safe = closeCandidates(group, a.tabMeta);
    const retained = group.some(
      (tab) => !safe.some((candidate) => candidate.id === tab.id),
    );
    return retained ? safe : safe.slice(1);
  });
  const closing =
    dialog === "duplicates"
      ? duplicateCandidates
      : closeCandidates(selectedTabs, a.tabMeta, closeOptions);
  const discarding = discardCandidates(selectedTabs, a.tabMeta);
  const grouped =
    a.config.tabView === "domains" || a.config.tabView === "windows"
      ? groupedTabRows(filtered, a.config.tabView)
      : null;
  const cardRows: Array<chrome.tabs.Tab[]> = [];
  for (let i = 0; i < filtered.length; i += columns)
    cardRows.push(filtered.slice(i, i + columns));
  return (
    <>
      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search titles and URLs"
        />
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
      <div className="tab-filters">
        <label>
          Show
          <select
            aria-label="Filter tabs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["all", "pinned", "favorites", "protected", "duplicates"].map(
              (value) => (
                <option key={value} value={value}>
                  {value === "all"
                    ? "All tabs"
                    : value[0]!.toUpperCase() + value.slice(1)}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Window
          <select
            aria-label="Filter window"
            value={windowId ?? "all"}
            onChange={(e) =>
              setWindowId(
                e.target.value === "all" ? null : Number(e.target.value),
              )
            }
          >
            <option value="all">All windows</option>
            {windows.map((id, i) => (
              <option value={id} key={id}>
                Window {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace
          <select
            aria-label="Filter workspace"
            value={context ?? "all"}
            onChange={(e) =>
              patch({
                activeWorkspaceId:
                  e.target.value === "all" ? null : e.target.value,
              })
            }
          >
            <option value="all">All workspaces</option>
            <option value="unassigned">Unassigned</option>
            {activeSpaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            aria-label="Sort tabs"
            value={a.config.tabSort}
            onChange={(e) =>
              patch({ tabSort: e.target.value as Config["tabSort"] })
            }
          >
            {[
              ["browser", "Browser order"],
              ["title", "Title"],
              ["domain", "Website"],
              ["recent", "Recently active"],
            ].map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented tab-view" aria-label="Tab layout">
          {[
            { id: "list", label: "List view", icon: List },
            { id: "cards", label: "Card view", icon: Grid2X2 },
            { id: "domains", label: "Domain view", icon: Globe },
            { id: "windows", label: "Window view", icon: PanelsTopLeft },
          ].map((view) => (
            <button
              key={view.id}
              aria-label={view.label}
              aria-pressed={a.config.tabView === view.id}
              onClick={() => patch({ tabView: view.id as Config["tabView"] })}
            >
              <view.icon size={16} />
            </button>
          ))}
        </div>
      </div>
      <Panel
        title={`${filtered.length} tabs`}
        label="LIVE BROWSER DATA"
        action={
          <button
            className="secondary"
            disabled={!duplicateCandidates.length || working}
            onClick={() => setDialog("duplicates")}
          >
            <Copy size={15} />
            Review duplicates
          </button>
        }
      >
        <div className="bulk-toolbar">
          <label className="select-all">
            <input
              type="checkbox"
              disabled={!selectable.length || working}
              checked={allSelected}
              onChange={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  for (const tab of selectable) {
                    if (allSelected) next.delete(tab.id!);
                    else next.add(tab.id!);
                  }
                  return next;
                })
              }
            />
            Select matching
          </label>
          <span className="caption">{validSelected.length} selected</span>
          <div className="bulk-buttons">
            <button
              className="icon-button"
              aria-label="Pin selected tabs"
              disabled={!validSelected.length || working}
              onClick={() =>
                execute({
                  kind: "pin",
                  ids: validSelected.map((t) => t.id!),
                  pinned: true,
                })
              }
            >
              <Pin size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="Unpin selected tabs"
              disabled={!validSelected.length || working}
              onClick={() =>
                execute({
                  kind: "pin",
                  ids: validSelected.map((t) => t.id!),
                  pinned: false,
                })
              }
            >
              <Pin size={15} fill="currentColor" />
            </button>
            <button
              className="icon-button"
              aria-label="Move selected tabs"
              disabled={!validSelected.length || working}
              onClick={() => setDialog("move")}
            >
              <MoveRight size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Group selected tabs"
              disabled={!validSelected.length || working}
              onClick={() => setDialog("group")}
            >
              <FolderPlus size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Ungroup selected tabs"
              disabled={!validSelected.length || working}
              onClick={() =>
                execute({
                  kind: "ungroup",
                  ids: validSelected.map((t) => t.id!),
                })
              }
            >
              <Layers size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Assign selected tabs to workspace"
              disabled={!validSelected.length || working}
              onClick={() => setDialog("assign")}
            >
              <Briefcase size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Discard selected tabs"
              disabled={!validSelected.length || working}
              onClick={() => setDialog("discard")}
            >
              <Moon size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="Close selected tabs"
              disabled={!validSelected.length || working}
              onClick={() => {
                setIncludePinned(false);
                setIncludeActive(false);
                setIncludeAudible(false);
                setDialog("close");
              }}
            >
              <X size={17} />
            </button>
          </div>
          <button
            className="text-button"
            disabled={!validSelected.length || working}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
        {result && (
          <p
            className={`action-result ${result.failed ? "failed" : ""}`}
            role={result.failed ? "alert" : "status"}
          >
            {result.message}
          </p>
        )}
        {working && (
          <p className="caption" role="status">
            Applying your tab action…
          </p>
        )}
        {filtered.length ? (
          <div ref={gridRef}>
            {a.config.tabView === "cards" ? (
              <VirtualList
                items={cardRows}
                rowHeight={178}
                label="Tab cards"
                render={(tabs) => (
                  <div
                    className="tab-card-row"
                    style={{
                      gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
                    }}
                  >
                    {tabs.map((tab) => (
                      <div key={tab.id}>{row(tab, true)}</div>
                    ))}
                  </div>
                )}
              />
            ) : grouped ? (
              <VirtualList
                items={grouped}
                rowHeight={66}
                label="Grouped browser tabs"
                render={(item) =>
                  item.kind === "heading" ? (
                    <div className="tab-group-heading">
                      <strong>{item.name}</strong>
                      <span>{item.count} tabs</span>
                    </div>
                  ) : (
                    row(item.tab)
                  )
                }
              />
            ) : (
              <VirtualList
                items={filtered}
                rowHeight={66}
                label="Browser tabs"
                render={(tab) => row(tab)}
              />
            )}
          </div>
        ) : (
          <Empty icon={<Layers />} title="A little breathing room">
            {installed
              ? "No tabs match this view. Change your filters or workspace."
              : "Browser tabs appear when Aether is installed as an extension."}
          </Empty>
        )}
        <div className="tab-list-footer">
          <p className="caption">
            Regular web tabs can be selected. Protection and labels apply to
            copies of the same URL, ignoring fragments.
          </p>
          {a.undoAction && (
            <button
              className="secondary"
              disabled={working}
              onClick={() => execute({ kind: "undo" })}
            >
              <Undo2 size={15} />
              Undo {a.undoAction.label.toLowerCase()}
            </button>
          )}
        </div>
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
      {edit && (
        <Modal
          title="A name that makes sense to you"
          onClose={() => setEdit(null)}
        >
          <Field label="Custom tab label">
            <input
              autoFocus
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={edit.title ?? "Use the page title"}
            />
          </Field>
          <p className="caption">
            Leave blank to use the page title. Labels stay on this device.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              aria-pressed={!!meta.get(metadataKey(edit.url) ?? "")?.favorite}
              onClick={() =>
                run(() =>
                  updateTabMeta(edit.url!, {
                    favorite: !meta.get(metadataKey(edit.url) ?? "")?.favorite,
                  }),
                )
              }
            >
              Favorite URL
            </button>
            <button
              className="secondary"
              aria-pressed={!!meta.get(metadataKey(edit.url) ?? "")?.protected}
              onClick={() =>
                run(() =>
                  updateTabMeta(edit.url!, {
                    protected: !meta.get(metadataKey(edit.url) ?? "")
                      ?.protected,
                  }),
                )
              }
            >
              Protect URL from closing
            </button>
          </div>
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                await updateTabMeta(edit.url!, { label: label.trim() });
                setEdit(null);
              }, "Tab label saved")
            }
          >
            Save label
          </button>
        </Modal>
      )}
      {dialog && (
        <Modal
          title={
            dialog === "duplicates"
              ? "Review duplicate tabs"
              : dialog === "close"
                ? "Close selected tabs?"
                : dialog === "discard"
                  ? "Discard selected tabs?"
                  : dialog === "move"
                    ? "Move selected tabs"
                    : dialog === "group"
                      ? "Group selected tabs"
                      : "Assign a workspace"
          }
          onClose={() => {
            if (!working) setDialog(null);
          }}
        >
          {(dialog === "close" || dialog === "duplicates") && (
            <>
              <p>
                {closing.length} tabs can be closed. Protected URLs are always
                kept.{" "}
                {dialog === "duplicates"
                  ? "Active, pinned, and audible tabs are also kept; at least one copy remains."
                  : "Active, pinned, and audible tabs are kept unless you explicitly include them."}
              </p>
              {dialog === "close" && (
                <div className="close-options">
                  {[
                    {
                      name: "Include pinned tabs",
                      value: includePinned,
                      set: setIncludePinned,
                    },
                    {
                      name: "Include active tabs",
                      value: includeActive,
                      set: setIncludeActive,
                    },
                    {
                      name: "Include tabs playing audio",
                      value: includeAudible,
                      set: setIncludeAudible,
                    },
                  ].map((option) => (
                    <label key={option.name}>
                      <input
                        type="checkbox"
                        checked={option.value}
                        onChange={(e) => option.set(e.target.checked)}
                      />
                      {option.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="dialog-list">
                {closing.slice(0, 100).map((tab) => (
                  <p key={tab.id}>
                    {tab.title || domain(tab.url!)}
                    <small className="muted"> · {domain(tab.url!)}</small>
                  </p>
                ))}
                {closing.length > 100 && (
                  <p>And {closing.length - 100} more reviewed tabs.</p>
                )}
              </div>
              <p className="caption">
                Undo reopens saved URL metadata; unsaved page state is not
                guaranteed. Keep a session snapshot for important work.
              </p>
              <button
                className="danger"
                disabled={!closing.length || working}
                onClick={() =>
                  execute({
                    kind: "close",
                    ids: closing.map((t) => t.id!),
                    ...(dialog === "duplicates" ? {} : closeOptions),
                  })
                }
              >
                Close {closing.length} reviewed tabs
              </button>
            </>
          )}
          {dialog === "discard" && (
            <>
              <p>
                {discarding.length} background tabs can be unloaded. Active,
                pinned, audible, protected, discarded, and browser-protected
                tabs are kept.
              </p>
              <p className="caption">
                Save unfinished work first. The browser does not expose every
                form or download state. No RAM savings estimate is provided.
              </p>
              <button
                className="primary"
                disabled={!discarding.length || working}
                onClick={() =>
                  execute({
                    kind: "discard",
                    ids: discarding.map((t) => t.id!),
                  })
                }
              >
                Discard reviewed tabs
              </button>
            </>
          )}
          {dialog === "move" && (
            <>
              <Field label="Destination window">
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="new">New window</option>
                  {windows.map((id, i) => (
                    <option key={id} value={id}>
                      Window {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted">
                Move {validSelected.length} selected web tabs. Undo can return
                them to their earlier windows.
              </p>
              <button
                className="primary"
                disabled={working}
                onClick={() =>
                  execute({
                    kind: "move",
                    ids: validSelected.map((t) => t.id!),
                    windowId:
                      destination === "new" ? null : Number(destination),
                  })
                }
              >
                Move tabs
              </button>
            </>
          )}
          {dialog === "group" && (
            <>
              <Field label="Group name">
                <input
                  autoFocus
                  maxLength={80}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Research"
                />
              </Field>
              <Field label="Group color">
                <select
                  value={groupColor}
                  onChange={(e) =>
                    setGroupColor(e.target.value as typeof groupColor)
                  }
                >
                  {["blue", "purple", "green", "red", "yellow", "grey"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <p className="caption">
                Create one native group per window. Pinned tabs are excluded.
                Native groups are separate from saved Aether workspaces.
              </p>
              <button
                className="primary"
                disabled={working || !groupName.trim()}
                onClick={() =>
                  execute({
                    kind: "group",
                    ids: validSelected.map((t) => t.id!),
                    title: groupName.trim(),
                    color: groupColor,
                  })
                }
              >
                Group tabs
              </button>
            </>
          )}
          {dialog === "assign" && (
            <>
              <Field label="Workspace">
                <select
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {activeSpaces.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="caption">
                A live tab belongs to one virtual workspace. This changes its
                context, not its browser window. Refresh a workspace snapshot
                explicitly to change its saved URLs.
              </p>
              <button
                className="primary"
                disabled={working}
                onClick={() =>
                  execute({
                    kind: "assign",
                    ids: validSelected.map((t) => t.id!),
                    workspaceId: workspace || null,
                  })
                }
              >
                Assign {validSelected.length} tabs
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
export function Performance({ a, run }: FeatureProps) {
  const candidates = discardCandidates(a.tabs, a.tabMeta);
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
                const response = await performTabAction({
                  kind: "discard",
                  ids: candidates.map((t) => t.id!),
                });
                if (response.failed) throw new Error(response.message);
                setConfirm(false);
                return response.changed;
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
