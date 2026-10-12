import { useState } from "react";
import {
  Briefcase,
  Archive,
  ArrowUpRight,
  Trash2,
  Plus,
  Check,
  FileText,
  Copy,
  Download,
} from "lucide-react";
import { AddButton, Empty, Field, Modal, Panel } from "../components/ui";
import { db } from "../lib/db";
import { getTabs, restoreTabs, download } from "../lib/browser";
import { domain, serializeTabs, type SavedTab } from "../lib/model";
import type { FeatureProps } from "./types";
export function Collections({
  a,
  run,
  kind,
}: FeatureProps & { kind: "workspaces" | "sessions" }) {
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#007aff");
  const [restoring, setRestoring] = useState<{
    name: string;
    tabs: SavedTab[];
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const rows = kind === "workspaces" ? a.workspaces : a.sessions;
  const noun = kind === "workspaces" ? "workspace" : "session";
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          {kind === "workspaces"
            ? "A place for every part of your day. Workspaces are saved URL collections."
            : "Snapshots of your regular web tabs. Restore them whenever you need."}
        </p>
        <AddButton
          onClick={() => {
            setName("");
            setCreate(true);
          }}
        >
          Save {noun}
        </AddButton>
      </div>
      {rows.length ? (
        <div className="collection-grid">
          {rows.map((row) => (
            <Panel key={row.id} className="collection-card">
              <div className="collection-top">
                <span
                  className="collection-icon"
                  style={{
                    color:
                      "color" in row && typeof row.color === "string"
                        ? row.color
                        : undefined,
                  }}
                >
                  {kind === "workspaces" ? (
                    <Briefcase size={22} />
                  ) : (
                    <Archive size={22} />
                  )}
                </span>
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
                          workspaces: kind === "workspaces" ? [row] : [],
                          sessions: kind === "sessions" ? [row] : [],
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
              <h2>{row.name}</h2>
              <p className="muted">
                {row.tabs.length} tabs ·{" "}
                {new Date(row.createdAt).toLocaleDateString()}
              </p>
              <div className="domain-stack">
                {[...new Set(row.tabs.map((t) => domain(t.url)))]
                  .slice(0, 3)
                  .map((host) => (
                    <span key={host}>{host}</span>
                  ))}
              </div>
              <div className="collection-footer">
                <button
                  className="secondary"
                  onClick={() =>
                    setRestoring({ name: row.name, tabs: row.tabs })
                  }
                >
                  Open <ArrowUpRight size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplicate ${row.name}`}
                  onClick={() =>
                    run(async () => {
                      const copy = {
                        ...row,
                        id: crypto.randomUUID(),
                        name: `${row.name} copy`.slice(0, 80),
                        createdAt: Date.now(),
                      };
                      if (kind === "workspaces")
                        await db.workspaces.add({
                          ...copy,
                          color:
                            "color" in row && typeof row.color === "string"
                              ? row.color
                              : "#007aff",
                        });
                      else await db.sessions.add(copy);
                    }, "Duplicated")
                  }
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${row.name}`}
                  onClick={() => setDeleting(row.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            icon={kind === "workspaces" ? <Briefcase /> : <Archive />}
            title={`Your first ${noun} starts here`}
            action={
              <AddButton onClick={() => setCreate(true)}>
                Save current tabs
              </AddButton>
            }
          >
            Save regular web tabs, including their pinned state and window
            arrangement. Private and browser-internal tabs are excluded.
          </Empty>
        </Panel>
      )}
      {create && (
        <Modal title={`Save a ${noun}`} onClose={() => setCreate(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (!name.trim())
                  throw new Error("Give this collection a name.");
                const tabs = serializeTabs(await getTabs());
                if (!tabs.length)
                  throw new Error("Open a regular web page before saving.");
                const value = {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  tabs,
                  createdAt: Date.now(),
                };
                if (kind === "workspaces")
                  await db.workspaces.add({ ...value, color });
                else await db.sessions.add(value);
                setCreate(false);
              }, `${noun} saved`);
            }}
          >
            <Field label="Name">
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "workspaces"
                    ? "e.g. Development"
                    : "e.g. Research, Monday"
                }
              />
            </Field>
            {kind === "workspaces" && (
              <Field label="Color">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </Field>
            )}
            <p className="muted">
              Save{" "}
              {
                a.tabs.filter((t) => !t.incognito && t.url?.startsWith("http"))
                  .length
              }{" "}
              regular web tabs across your windows.
            </p>
            <button className="primary" type="submit">
              Save {noun}
            </button>
          </form>
        </Modal>
      )}
      {restoring && (
        <Modal
          title={`Open ${restoring.name}`}
          onClose={() => setRestoring(null)}
        >
          <p>
            This opens {restoring.tabs.length} tabs in new windows. Existing
            tabs remain open. Unsaved page state is not included.
          </p>
          <div className="dialog-list">
            {restoring.tabs.map((tab, i) => (
              <label className="restore-row" key={`${i}-${tab.url}`}>
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    setRestoring({
                      ...restoring,
                      tabs: restoring.tabs.filter((_, j) => i !== j),
                    })
                  }
                />
                <span>
                  {tab.title}
                  <small>{domain(tab.url)}</small>
                </span>
              </label>
            ))}
          </div>
          <button
            disabled={!restoring.tabs.length}
            className="primary"
            onClick={() =>
              run(async () => {
                await restoreTabs(restoring.tabs);
                setRestoring(null);
              }, "Tabs restored")
            }
          >
            Open selected tabs
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal title={`Delete ${noun}?`} onClose={() => setDeleting(null)}>
          <p>
            This removes the saved collection. Open browser tabs are unaffected.
          </p>
          <button
            className="danger"
            onClick={() =>
              run(async () => {
                await db[kind].delete(deleting);
                setDeleting(null);
              }, "Deleted")
            }
          >
            Delete saved {noun}
          </button>
        </Modal>
      )}
    </>
  );
}
export function Notes({ a, run }: FeatureProps) {
  const [edit, setEdit] = useState<{
    id: string;
    title: string;
    body: string;
    done: boolean;
  } | null>(null);
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          A quiet space for thoughts, links, and things to do.
        </p>
        <AddButton
          onClick={() =>
            setEdit({
              id: crypto.randomUUID(),
              title: "",
              body: "",
              done: false,
            })
          }
        >
          New note
        </AddButton>
      </div>
      {a.notes.length ? (
        <div className="collection-grid">
          {a.notes.map((note) => (
            <Panel key={note.id} className="note-card">
              <div className="collection-top">
                <button
                  className={`icon-button ${note.done ? "checked" : ""}`}
                  aria-label={note.done ? "Mark incomplete" : "Mark complete"}
                  onClick={() =>
                    run(() => db.notes.update(note.id, { done: !note.done }))
                  }
                >
                  <Check size={17} />
                </button>
                <button className="text-button" onClick={() => setEdit(note)}>
                  Edit
                </button>
              </div>
              <h2 className={note.done ? "completed" : ""}>
                {note.title || "Untitled note"}
              </h2>
              <p className="note-body">{note.body}</p>
              <small className="muted">
                Edited {new Date(note.updatedAt).toLocaleDateString()}
              </small>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty icon={<FileText />} title="Keep a thought close">
            Your notes stay on this device. Create a note to get started.
          </Empty>
        </Panel>
      )}
      {edit && (
        <Modal title="Your note" onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await db.notes.put({ ...edit, updatedAt: Date.now() });
                setEdit(null);
              }, "Note saved");
            }}
          >
            <Field label="Title">
              <input
                autoFocus
                maxLength={120}
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                placeholder="A thought worth keeping"
              />
            </Field>
            <Field label="Note">
              <textarea
                rows={8}
                maxLength={100000}
                value={edit.body}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                placeholder="Write something…"
              />
            </Field>
            <div className="button-row">
              <button className="primary" type="submit">
                <Plus size={15} />
                Save note
              </button>
              <button
                type="button"
                className="text-button danger-text"
                onClick={() =>
                  run(async () => {
                    await db.notes.delete(edit.id);
                    setEdit(null);
                  }, "Note deleted")
                }
              >
                Delete note
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
