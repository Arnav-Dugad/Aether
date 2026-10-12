import { useRef, useState } from "react";
import {
  Briefcase,
  Archive,
  ArrowUpRight,
  Trash2,
  Copy,
  Download,
  Pencil,
  Pin,
} from "lucide-react";
import {
  AddButton,
  Empty,
  Field,
  Modal,
  Panel,
  SearchField,
} from "../components/ui";
import { db } from "../lib/db";
import { getTabs, restoreTabs, download } from "../lib/browser";
import {
  domain,
  safeUrl,
  serializeTabs,
  workspaceSchema,
  sessionSchema,
  type SavedTab,
  type Workspace,
  type Session,
} from "../lib/model";
import { assignTabs } from "../lib/tabActions";
import { compareSnapshots } from "../lib/collections";
import type { FeatureProps } from "./types";
import "./collections.css";

type Collection = Workspace | Session;
type Editor = {
  id?: string;
  name: string;
  color: string;
  description: string;
  tabs: SavedTab[];
  archived: boolean;
  template: boolean;
};
const freshEditor = (): Editor => ({
  name: "",
  color: "#007aff",
  description: "",
  tabs: [],
  archived: false,
  template: false,
});
export function Collections({
  a,
  run,
  kind,
  navigate,
}: FeatureProps & { kind: "workspaces" | "sessions" }) {
  const workspaceMode = kind === "workspaces";
  const noun = workspaceMode ? "workspace" : "session";
  const rows: Collection[] = workspaceMode ? a.workspaces : a.sessions;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [scope, setScope] = useState("all");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [restoring, setRestoring] = useState<{
    name: string;
    tabs: SavedTab[];
    selected: number[];
    workspaceId?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [busy, setBusy] = useState(false);
  const restoreLock = useRef(false);
  const [progress, setProgress] = useState({ opened: 0, total: 0 });
  const [restoreError, setRestoreError] = useState("");
  const [compare, setCompare] = useState(false);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const matching = rows.filter((row) => {
    const status =
      !workspaceMode ||
      ("archived" in row &&
        (filter === "all" ||
          (filter === "archive"
            ? row.archived
            : filter === "templates"
              ? row.template && !row.archived
              : !row.archived && !row.template)));
    const text = [
      row.name,
      "description" in row ? row.description : "",
      ...row.tabs.map((tab) => `${tab.title} ${tab.url}`),
    ]
      .join(" ")
      .toLowerCase();
    return status && text.includes(query.toLowerCase());
  });
  async function capture() {
    const tabs = await getTabs();
    if (scope === "current") {
      const current =
        typeof chrome !== "undefined" && chrome.windows?.getCurrent
          ? await chrome.windows.getCurrent()
          : null;
      const windowId = current?.id ?? tabs.find((tab) => tab.active)?.windowId;
      return serializeTabs(tabs.filter((tab) => tab.windowId === windowId));
    }
    return serializeTabs(tabs);
  }
  function beginCreate() {
    setScope("all");
    setEditor(freshEditor());
    setUrl("");
    setUrlError("");
  }
  function edit(row: Collection) {
    setEditor({
      ...freshEditor(),
      ...row,
      tabs: row.tabs.map((tab) => ({ ...tab })),
    });
    setUrl("");
    setUrlError("");
  }
  async function saveCopy(row: Collection, template = false) {
    const value = {
      ...row,
      id: crypto.randomUUID(),
      name: `${row.name}${template ? " template" : " copy"}`.slice(0, 80),
      createdAt: Date.now(),
    };
    if (workspaceMode)
      await db.workspaces.add(
        workspaceSchema.parse({ ...value, archived: false, template }),
      );
    else await db.sessions.add(sessionSchema.parse(value));
  }
  const before = a.sessions.find((row) => row.id === left);
  const after = a.sessions.find((row) => row.id === right);
  const difference =
    before && after ? compareSnapshots(before.tabs, after.tabs) : null;
  return (
    <div className="collections-surface">
      <div className="toolbar">
        <p className="muted">
          {workspaceMode
            ? "Organize saved pages into spaces for each part of your day."
            : "Keep a snapshot of your tabs, pinned pages, and window arrangement."}
        </p>
        <div className="collection-actions">
          {!workspaceMode && (
            <button
              className="secondary"
              disabled={rows.length < 2}
              onClick={() => {
                setLeft(a.sessions[1]?.id ?? "");
                setRight(a.sessions[0]?.id ?? "");
                setCompare(true);
              }}
            >
              Compare sessions
            </button>
          )}
          <AddButton onClick={beginCreate}>Save {noun}</AddButton>
        </div>
      </div>
      <div className="collection-controls">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={`Search ${kind}`}
        />
        {workspaceMode && (
          <div
            className="collection-filters"
            role="group"
            aria-label="Workspace filter"
          >
            {(
              [
                ["active", "Active"],
                ["templates", "Templates"],
                ["archive", "Archive"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className="secondary"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <span className="muted">
          {matching.length} {matching.length === 1 ? noun : kind}
        </span>
      </div>
      {matching.length ? (
        <div className="collection-grid">
          {matching.map((row) => (
            <Panel
              key={row.id}
              className={`collection-card ${workspaceMode && a.config.activeWorkspaceId === row.id ? "collection-active" : ""}`}
            >
              <div className="collection-top">
                <span
                  className="collection-icon"
                  style={{ color: "color" in row ? row.color : undefined }}
                >
                  {workspaceMode ? (
                    <Briefcase size={22} />
                  ) : (
                    <Archive size={22} />
                  )}
                </span>
                <div className="collection-actions">
                  {"template" in row && row.template && (
                    <span className="collection-badge">Template</span>
                  )}
                  {"archived" in row && row.archived && (
                    <span className="collection-badge">Archived</span>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Export ${row.name}`}
                    onClick={() =>
                      download(
                        `${noun}.json`,
                        JSON.stringify(
                          {
                            version: 1,
                            config: a.config,
                            workspaces: workspaceMode ? [row] : [],
                            sessions: workspaceMode ? [] : [row],
                            notes: [],
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              <h2>{row.name}</h2>
              {"description" in row && row.description && (
                <p className="collection-description">{row.description}</p>
              )}
              <p className="muted">
                {row.tabs.length} tabs ·{" "}
                {new Set(row.tabs.map((tab) => tab.window)).size} windows ·{" "}
                {new Date(row.createdAt).toLocaleDateString()}
              </p>
              <div className="domain-stack">
                {[...new Set(row.tabs.map((tab) => domain(tab.url)))]
                  .slice(0, 3)
                  .map((host) => (
                    <span key={host}>{host}</span>
                  ))}
              </div>
              <div className="collection-footer">
                <button
                  className="secondary"
                  disabled={!row.tabs.length}
                  onClick={() => {
                    setRestoreError("");
                    setProgress({ opened: 0, total: 0 });
                    setRestoring({
                      name: row.name,
                      tabs: row.tabs,
                      workspaceId:
                        workspaceMode &&
                        "archived" in row &&
                        !row.archived &&
                        !row.template
                          ? row.id
                          : undefined,
                      selected: row.tabs.map((_, i) => i),
                    });
                  }}
                >
                  Open <ArrowUpRight size={15} />
                </button>
                {workspaceMode && (
                  <button
                    className="secondary"
                    disabled={
                      "archived" in row && (row.archived || row.template)
                    }
                    aria-pressed={a.config.activeWorkspaceId === row.id}
                    onClick={() =>
                      run(async () => {
                        await a.patchConfig({ activeWorkspaceId: row.id });
                        navigate?.("tabs");
                      }, "Workspace selected")
                    }
                  >
                    Switch
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`Edit ${row.name}`}
                  onClick={() => edit(row)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplicate ${row.name}`}
                  onClick={() => run(() => saveCopy(row), "Duplicated")}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${row.name}`}
                  onClick={() => setDeleting(row)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {workspaceMode && "archived" in row && (
                <div className="collection-secondary-actions">
                  <button
                    className="text-button"
                    onClick={() =>
                      run(
                        async () => {
                          await db.workspaces.put(
                            workspaceSchema.parse({
                              ...row,
                              archived: !row.archived,
                            }),
                          );
                          if (
                            !row.archived &&
                            a.config.activeWorkspaceId === row.id
                          )
                            await a.patchConfig({ activeWorkspaceId: null });
                        },
                        row.archived ? "Unarchived" : "Archived",
                      )
                    }
                  >
                    {row.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    className="text-button"
                    disabled={row.archived || row.template}
                    onClick={() =>
                      run(async () => {
                        const tabs = await getTabs();
                        const current =
                          typeof chrome !== "undefined" &&
                          chrome.windows?.getCurrent
                            ? await chrome.windows.getCurrent()
                            : null;
                        const windowId =
                          current?.id ??
                          tabs.find((tab) => tab.active)?.windowId;
                        await assignTabs(
                          tabs
                            .filter(
                              (tab) =>
                                tab.windowId === windowId &&
                                !tab.incognito &&
                                tab.url &&
                                safeUrl(tab.url),
                            )
                            .flatMap((tab) =>
                              tab.id === undefined ? [] : [tab.id],
                            ),
                          row.id,
                        );
                      }, "Current window assigned")
                    }
                  >
                    Assign current window
                  </button>
                  {row.template && (
                    <button
                      className="text-button"
                      onClick={() =>
                        run(
                          () => saveCopy(row),
                          "Workspace created from template",
                        )
                      }
                    >
                      Use template
                    </button>
                  )}
                  {!row.template && (
                    <button
                      className="text-button"
                      onClick={() =>
                        run(() => saveCopy(row, true), "Template created")
                      }
                    >
                      Save as template
                    </button>
                  )}
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            icon={workspaceMode ? <Briefcase /> : <Archive />}
            title={
              rows.length
                ? `No matching ${kind}`
                : `Your first ${noun} starts here`
            }
            action={
              !rows.length ? (
                <AddButton onClick={beginCreate}>Save current tabs</AddButton>
              ) : (
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Show all
                </button>
              )
            }
          >
            {rows.length
              ? "Try a different search or filter."
              : "Save regular web tabs. Private and browser-internal tabs are excluded."}
          </Empty>
        </Panel>
      )}
      {editor && (
        <Modal
          title={`${editor.id ? "Edit" : "Save a"} ${noun}`}
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const tabs = editor.id ? editor.tabs : await capture();
                if (!tabs.length)
                  throw new Error("Add a regular web page before saving.");
                const original = rows.find((row) => row.id === editor.id);
                const value = {
                  ...editor,
                  name: editor.name.trim(),
                  tabs,
                  id: editor.id ?? crypto.randomUUID(),
                  createdAt: original?.createdAt ?? Date.now(),
                };
                if (workspaceMode)
                  await db.workspaces.put(workspaceSchema.parse(value));
                else await db.sessions.put(sessionSchema.parse(value));
                setEditor(null);
              }, `${noun} saved`);
            }}
          >
            <Field label="Name">
              <input
                autoFocus
                required
                maxLength={80}
                value={editor.name}
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
                placeholder={
                  workspaceMode ? "e.g. Development" : "e.g. Research, Monday"
                }
              />
            </Field>
            {workspaceMode && (
              <>
                <Field label="Color">
                  <input
                    type="color"
                    value={editor.color}
                    onChange={(event) =>
                      setEditor({ ...editor, color: event.target.value })
                    }
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={editor.description}
                    onChange={(event) =>
                      setEditor({ ...editor, description: event.target.value })
                    }
                    placeholder="What belongs in this workspace?"
                  />
                </Field>
              </>
            )}
            {(!editor.id || workspaceMode) && (
              <Field label="Capture from">
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="all">All regular windows</option>
                  <option value="current">Current window</option>
                </select>
              </Field>
            )}
            {!editor.id ? (
              <p className="muted">
                Saving captures regular web tabs with their pinned state and
                window arrangement.
              </p>
            ) : (
              workspaceMode && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        const tabs = await capture();
                        if (!tabs.length)
                          throw new Error("No regular web tabs to capture.");
                        setEditor({ ...editor, tabs });
                      }, "Snapshot refreshed in editor. Save to keep it.")
                    }
                  >
                    Replace saved tabs with current snapshot
                  </button>
                  <div className="collection-editor-tabs">
                    {editor.tabs.map((tab, i) => (
                      <div
                        key={`${i}-${tab.url}`}
                        className="collection-editor-row"
                      >
                        <span>
                          <strong>{tab.title}</strong>
                          <small>{tab.url}</small>
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove saved tab ${tab.title}`}
                          onClick={() =>
                            setEditor({
                              ...editor,
                              tabs: editor.tabs.filter(
                                (_, index) => index !== i,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Field label="Add URL">
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setUrlError("");
                      }}
                      placeholder="https://example.com"
                    />
                  </Field>
                  {urlError && (
                    <p role="alert" className="collection-error">
                      {urlError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const valid = safeUrl(url.trim());
                      if (!valid) {
                        setUrlError("Use a complete http or https URL.");
                        return;
                      }
                      setEditor({
                        ...editor,
                        tabs: [
                          ...editor.tabs,
                          {
                            url: valid,
                            title: domain(valid),
                            pinned: false,
                            window: 0,
                          },
                        ],
                      });
                      setUrl("");
                    }}
                  >
                    Add saved page
                  </button>
                </>
              )
            )}
            <div className="collection-dialog-footer">
              <button
                className="secondary"
                type="button"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button className="primary" type="submit">
                Save {noun}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {restoring && (
        <Modal
          title={`Open ${restoring.name}`}
          onClose={() => {
            if (!restoreLock.current) setRestoring(null);
          }}
        >
          <p>
            Selected pages open in new windows, keeping pinned states and saved
            window groups. Existing tabs remain open. Unsaved page state is not
            included.
          </p>
          <div className="collection-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                setRestoring({
                  ...restoring,
                  selected: restoring.tabs.map((_, i) => i),
                })
              }
            >
              Select all
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setRestoring({ ...restoring, selected: [] })}
            >
              Select none
            </button>
            <span className="muted">{restoring.selected.length} selected</span>
          </div>
          <div className="dialog-list">
            {restoring.tabs.map((tab, i) => (
              <label className="restore-row" key={`${i}-${tab.url}`}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={restoring.selected.includes(i)}
                  onChange={(event) =>
                    setRestoring({
                      ...restoring,
                      selected: event.target.checked
                        ? [...restoring.selected, i]
                        : restoring.selected.filter((index) => index !== i),
                    })
                  }
                />
                <span>
                  {tab.title}
                  <small>
                    {domain(tab.url)} · Window {tab.window + 1}
                    {tab.pinned && (
                      <>
                        {" "}
                        · <Pin size={11} /> Pinned
                      </>
                    )}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {busy && (
            <div role="status">
              <progress value={progress.opened} max={progress.total || 1} />
              <p>
                {progress.opened} of {progress.total} tabs opened
              </p>
            </div>
          )}
          {restoreError && (
            <p role="alert" className="collection-error">
              {restoreError}
            </p>
          )}
          <button
            disabled={busy || !restoring.selected.length}
            className="primary"
            onClick={() => {
              if (restoreLock.current) return;
              restoreLock.current = true;
              setBusy(true);
              setRestoreError("");
              const selected = restoring.tabs.filter((_, i) =>
                restoring.selected.includes(i),
              );
              setProgress({ opened: 0, total: selected.length });
              void restoreTabs(
                selected,
                (opened: number, total: number) =>
                  setProgress({ opened, total }),
                restoring.workspaceId,
              )
                .then(() => setRestoring(null))
                .catch((error: unknown) => {
                  setRestoreError(
                    `${error instanceof Error ? error.message : "Could not restore tabs."} Some pages may already be open. Check your browser before retrying.`,
                  );
                })
                .finally(() => {
                  restoreLock.current = false;
                  setBusy(false);
                });
            }}
          >
            Open selected tabs
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal title={`Delete ${noun}?`} onClose={() => setDeleting(null)}>
          <p>
            Delete “{deleting.name}”? This removes the saved collection. Open
            browser tabs are unaffected.
          </p>
          <div className="collection-dialog-footer">
            <button className="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="danger"
              onClick={() =>
                run(async () => {
                  if (workspaceMode)
                    await assignTabs(
                      Object.entries(a.tabAssignments)
                        .filter(([, id]) => id === deleting.id)
                        .map(([id]) => Number(id)),
                      null,
                    );
                  await db[kind].delete(deleting.id);
                  if (
                    workspaceMode &&
                    a.config.activeWorkspaceId === deleting.id
                  )
                    await a.patchConfig({ activeWorkspaceId: null });
                  setDeleting(null);
                }, "Deleted")
              }
            >
              Delete saved {noun}
            </button>
          </div>
        </Modal>
      )}
      {compare && (
        <Modal title="Compare sessions" onClose={() => setCompare(false)}>
          <div className="collection-compare-selects">
            <Field label="Earlier snapshot">
              <select
                value={left}
                onChange={(event) => setLeft(event.target.value)}
              >
                {a.sessions.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Later snapshot">
              <select
                value={right}
                onChange={(event) => setRight(event.target.value)}
              >
                {a.sessions.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="muted">
            Comparison includes exact URLs, pinned states and saved window
            groups. A changed pin or window appears as a removal and addition.
          </p>
          {difference && (
            <>
              <p role="status">
                {difference.unchanged} unchanged · {difference.added.length}{" "}
                added · {difference.removed.length} removed
              </p>
              {[
                ["Added in later snapshot", difference.added],
                ["Removed from earlier snapshot", difference.removed],
              ].map(([label, tabs]) => (
                <section key={label as string}>
                  <h3>{label as string}</h3>
                  {(tabs as SavedTab[]).length ? (
                    <div className="collection-editor-tabs">
                      {(tabs as SavedTab[]).map((tab, index) => (
                        <div className="collection-editor-row" key={index}>
                          <span>
                            <strong>{tab.title}</strong>
                            <small>
                              {tab.url} · Window {tab.window + 1}
                              {tab.pinned ? " · Pinned" : ""}
                            </small>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">None</p>
                  )}
                </section>
              ))}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
