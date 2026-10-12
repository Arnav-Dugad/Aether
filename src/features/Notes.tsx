import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, FileText, Link, Plus } from "lucide-react";
import {
  AddButton,
  Empty,
  Field,
  Modal,
  Panel,
  SearchField,
} from "../components/ui";
import { db } from "../lib/db";
import { download, openUrl } from "../lib/browser";
import { noteSchema, safeUrl, type Note } from "../lib/model";
import { NoteWriter, type SaveStatus } from "../lib/noteWriter";
import type { FeatureProps } from "./types";
import "./notes.css";

// Keeps unsuccessful drafts recoverable while navigating inside Aether.
// This is memory only; browser unload can still lose uncommitted changes.
const pendingDrafts = new Map<string, Note>();
const deletedNotes = new Set<string>();

function inlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(
    /(\[[^\]\n]+\]\([^\s)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g,
  );
  return tokens.map((token, i) => {
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return safeUrl(link[2]!) ? (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      ) : (
        token
      );
    if (token.startsWith("**") && token.endsWith("**"))
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*"))
      return <em key={i}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={i}>{token.slice(1, -1)}</code>;
    return token;
  });
}
function MarkdownPreview({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.startsWith("```"))
        code.push(lines[i]!);
      blocks.push(
        <pre key={i}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
    } else if (/^[-*] /.test(line)) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && /^[-*] /.test(lines[i + 1]!))
        items.push(lines[++i]!.slice(2));
      blocks.push(
        <ul key={i}>
          {items.map((item, index) => (
            <li key={index}>{inlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
    } else {
      const heading = line.match(/^(#{1,3}) (.+)$/);
      const content = inlineMarkdown(heading ? heading[2]! : line);
      blocks.push(
        heading ? (
          heading[1]!.length === 1 ? (
            <h2 key={i}>{content}</h2>
          ) : heading[1]!.length === 2 ? (
            <h3 key={i}>{content}</h3>
          ) : (
            <h4 key={i}>{content}</h4>
          )
        ) : (
          <p key={i}>{content || "\u00a0"}</p>
        ),
      );
    }
  }
  return (
    <div className="note-markdown-preview" aria-label="Markdown preview">
      {body ? blocks : <p className="muted">Your preview appears here.</p>}
    </div>
  );
}

function NoteEditor({
  initial,
  existing,
  workspaces,
  activeUrl,
  onClose,
  onError,
}: {
  initial: Note;
  existing: boolean;
  workspaces: FeatureProps["a"]["workspaces"];
  activeUrl?: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  // The initial snapshot is intentionally independent of liveQuery refreshes.
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const conflictRef = useRef<Note | null>(null);
  const persisted = useRef(existing);
  const writer = useRef<NoteWriter<Note> | null>(null);
  if (!writer.current)
    writer.current = new NoteWriter<Note>(
      async (value) => {
        if (conflictRef.current)
          throw new Error(
            "A newer saved version exists. Export your draft or load the saved version below.",
          );
        const parsed = noteSchema.safeParse({
          ...value,
          updatedAt: Date.now(),
        });
        if (!parsed.success)
          throw new Error(
            parsed.error.issues[0]?.message || "Check your note fields.",
          );
        await db.transaction("rw", db.notes, async () => {
          if (deletedNotes.has(value.id)) return;
          const stored = await db.notes.get(value.id);
          if (stored && stored.updatedAt > value.updatedAt) {
            const fields = [
              "title",
              "body",
              "done",
              "workspaceId",
              "url",
              "priority",
              "dueDate",
            ] as const;
            const normalized = noteSchema.parse(stored);
            if (
              fields.some((field) => normalized[field] !== parsed.data[field])
            ) {
              conflictRef.current = normalized;
              setConflict(normalized);
              throw new Error(
                "A newer saved version exists. Your draft has not been saved.",
              );
            }
          } else await db.notes.put(parsed.data);
        });
        persisted.current = true;
        if (pendingDrafts.get(value.id) === value)
          pendingDrafts.delete(value.id);
      },
      (next, failure) => {
        setStatus(next);
        setError(
          next === "error"
            ? String(failure instanceof Error ? failure.message : failure)
            : "",
        );
      },
    );
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  useEffect(() => {
    const flush = () => {
      void writer.current
        ?.flush()
        .catch((e) => errorHandler.current(String(e)));
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
      flush();
    };
  }, []);
  const change = (patch: Partial<Note>) => {
    const next = {
      ...draft,
      ...patch,
      updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
    };
    setDraft(next);
    pendingDrafts.set(next.id, next);
    writer.current!.queue(next);
  };
  const close = async (saveEmpty = false) => {
    if (closing) return;
    setClosing(true);
    try {
      if (saveEmpty) writer.current!.queue(draft);
      await writer.current!.flush();
      onClose();
    } catch {
      setClosing(false);
    }
  };
  const remove = async () => {
    setClosing(true);
    try {
      deletedNotes.add(draft.id);
      await writer.current!.remove(() => db.notes.delete(draft.id));
      pendingDrafts.delete(draft.id);
      onClose();
    } catch {
      deletedNotes.delete(draft.id);
      setClosing(false);
    }
  };
  const loadSaved = async () => {
    setClosing(true);
    try {
      // Stop this writer without deleting the note, including its retained failed draft.
      await writer.current!.remove(async () => {});
      const stored = await db.notes.get(draft.id);
      if (!stored)
        throw new Error(
          "The saved note no longer exists. Export your draft to keep a copy.",
        );
      const saved = noteSchema.parse(stored);
      pendingDrafts.delete(draft.id);
      writer.current = null;
      conflictRef.current = null;
      setDraft(saved);
      setConflict(null);
      setConfirmLoad(false);
      setError("");
      setStatus("idle");
      persisted.current = true;
    } catch (failure) {
      // The canceled writer must be replaced so a later explicit retry remains possible.
      writer.current = null;
      setError(failure instanceof Error ? failure.message : String(failure));
      setStatus("error");
    } finally {
      setClosing(false);
    }
  };
  const unavailableWorkspace =
    draft.workspaceId && !workspaces.some((w) => w.id === draft.workspaceId);
  return (
    <Modal
      title="Your note"
      onClose={() => {
        void close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void close(true);
        }}
      >
        <Field label="Title">
          <input
            autoFocus
            maxLength={120}
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
            placeholder="A thought worth keeping"
            disabled={closing}
          />
        </Field>
        <Field label="Note">
          <textarea
            rows={8}
            maxLength={100000}
            value={draft.body}
            onChange={(e) => change({ body: e.target.value })}
            placeholder="Write something…"
            disabled={closing}
          />
        </Field>
        <button
          type="button"
          className="text-button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Hide preview" : "Preview Markdown"}
        </button>
        {preview && <MarkdownPreview body={draft.body} />}
        <div className="note-editor-grid">
          <Field label="Workspace">
            <select
              value={draft.workspaceId ?? ""}
              disabled={closing}
              onChange={(e) => change({ workspaceId: e.target.value || null })}
            >
              <option value="">No workspace</option>
              {unavailableWorkspace && (
                <option value={draft.workspaceId!}>
                  Unavailable workspace
                </option>
              )}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={draft.priority}
              disabled={closing}
              onChange={(e) =>
                change({ priority: e.target.value as Note["priority"] })
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={draft.dueDate ?? ""}
              disabled={closing}
              onChange={(e) => change({ dueDate: e.target.value || null })}
            />
          </Field>
          <Field label="Link (http or https)">
            <input
              type="url"
              placeholder="https://example.com"
              value={draft.url ?? ""}
              disabled={closing}
              onChange={(e) => change({ url: e.target.value || null })}
            />
          </Field>
        </div>
        {activeUrl && (
          <button
            type="button"
            className="text-button"
            disabled={closing}
            onClick={() => change({ url: activeUrl })}
          >
            <Link size={14} />
            Use current tab link
          </button>
        )}
        <label className="setting-row">
          <span>Complete</span>
          <input
            type="checkbox"
            checked={draft.done}
            disabled={closing}
            onChange={(e) => change({ done: e.target.checked })}
          />
        </label>
        <p
          className={`note-save-status ${status === "error" ? "danger-text" : "muted"}`}
          role="status"
          aria-live="polite"
        >
          {status === "idle"
            ? existing
              ? "Saved on this device"
              : "Changes save automatically on this device"
            : status === "pending"
              ? "Changes pending…"
              : status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved on this device"
                  : `Could not save: ${error}`}
        </p>
        {conflict && (
          <div
            className="note-conflict"
            role="group"
            aria-label="Resolve note conflict"
          >
            <p>
              A newer saved version has different content. Your draft is still
              shown above and has not replaced it.
            </p>
            <p className="muted">
              Saved title: {conflict.title || "Untitled note"}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  download(
                    `aether-note-draft-${draft.id}.json`,
                    JSON.stringify(draft, null, 2),
                  )
                }
              >
                Export my draft
              </button>
              <button
                type="button"
                className="text-button"
                disabled={closing}
                onClick={() => setConfirmLoad(true)}
              >
                Load saved version
              </button>
            </div>
            {confirmLoad && (
              <>
                <p>
                  Discard the draft shown above and load the latest saved note?
                  Export your draft first if you want to keep it.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="danger-text"
                    disabled={closing}
                    onClick={() => {
                      void loadSaved();
                    }}
                  >
                    Discard draft and load saved
                  </button>
                  <button
                    type="button"
                    disabled={closing}
                    onClick={() => setConfirmLoad(false)}
                  >
                    Keep editing draft
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {status === "error" && !conflict && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              void writer.current!.flush().catch(() => {});
            }}
          >
            Retry saving
          </button>
        )}
        <div className="button-row">
          <button className="primary" type="submit" disabled={closing}>
            <Plus size={15} />
            Save note
          </button>
          <button
            type="button"
            className="text-button danger-text"
            disabled={closing}
            onClick={() => {
              if (persisted.current) setConfirmDelete(true);
              else void remove();
            }}
          >
            Delete note
          </button>
        </div>
        {confirmDelete && (
          <div
            className="note-markdown-preview"
            role="group"
            aria-label="Confirm deletion"
          >
            <p>Delete this note permanently from this device?</p>
            <div className="button-row">
              <button
                type="button"
                className="danger-text"
                disabled={closing}
                onClick={() => {
                  void remove();
                }}
              >
                Delete permanently
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => setConfirmDelete(false)}
              >
                Keep note
              </button>
            </div>
          </div>
        )}
        <small className="muted">
          Wait for “Saved on this device” before closing the browser. Pending
          edits may not finish if the page is unloaded.
        </small>
      </form>
    </Modal>
  );
}

export function Notes({ a, run }: FeatureProps) {
  const [edit, setEdit] = useState<{ note: Note; existing: boolean } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const allNotes = [
    ...new Map(
      [...a.notes, ...pendingDrafts.values()].map((note) => [note.id, note]),
    ).values(),
  ];
  const notes = allNotes.filter(
    (note) =>
      (filter === "all" || note.done === (filter === "complete")) &&
      `${note.title} ${note.body} ${note.url ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const activeUrl = a.tabs.find(
    (tab) =>
      tab.active &&
      tab.windowId === a.currentWindowId &&
      tab.url &&
      safeUrl(tab.url),
  )?.url;
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          A quiet space for thoughts, links, and things to do.
        </p>
        <AddButton
          onClick={() =>
            setEdit({
              note: noteSchema.parse({
                id: crypto.randomUUID(),
                title: "",
                body: "",
                done: false,
                updatedAt: Date.now(),
                workspaceId: a.config.activeWorkspaceId,
              }),
              existing: false,
            })
          }
        >
          New note
        </AddButton>
      </div>
      <div className="notes-controls">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search notes…"
        />
        <select
          aria-label="Filter notes"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All notes</option>
          <option value="incomplete">Incomplete</option>
          <option value="complete">Complete</option>
        </select>
        <small className="muted">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </small>
      </div>
      {notes.length ? (
        <div className="collection-grid">
          {notes.map((note) => (
            <Panel key={note.id} className="note-card">
              <div className="collection-top">
                <button
                  className={`icon-button ${note.done ? "checked" : ""}`}
                  aria-label={note.done ? "Mark incomplete" : "Mark complete"}
                  onClick={() =>
                    run(() =>
                      db.notes.put(
                        noteSchema.parse({
                          ...note,
                          done: !note.done,
                          updatedAt: Date.now(),
                        }),
                      ),
                    )
                  }
                >
                  <Check size={17} />
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    setEdit({
                      note,
                      existing: a.notes.some((saved) => saved.id === note.id),
                    })
                  }
                >
                  Edit
                </button>
              </div>
              <h2 className={note.done ? "completed" : ""}>
                {note.title || "Untitled note"}
              </h2>
              <p className="note-body">{note.body}</p>
              <div className="note-metadata">
                {note.priority && note.priority !== "normal" && (
                  <span className={`note-chip ${note.priority}`}>
                    {note.priority === "high"
                      ? "High priority"
                      : "Low priority"}
                  </span>
                )}
                {note.dueDate && (
                  <span className="note-chip">Due {note.dueDate}</span>
                )}
                {note.workspaceId && (
                  <span className="note-chip">
                    {a.workspaces.find((w) => w.id === note.workspaceId)
                      ?.name ?? "Unavailable workspace"}
                  </span>
                )}
              </div>
              {note.url && safeUrl(note.url) && (
                <button
                  className="text-button"
                  onClick={() => run(() => openUrl(note.url!))}
                >
                  <Link size={14} />
                  Open link
                </button>
              )}
              <small className="muted">
                Edited {new Date(note.updatedAt).toLocaleDateString()}
              </small>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            icon={<FileText />}
            title={
              allNotes.length ? "No matching notes" : "Keep a thought close"
            }
          >
            {allNotes.length
              ? "Try another search or filter."
              : "Your notes stay on this device. Create a note to get started."}
          </Empty>
        </Panel>
      )}
      {edit && (
        <NoteEditor
          key={edit.note.id}
          initial={edit.note}
          existing={edit.existing}
          workspaces={a.workspaces}
          activeUrl={activeUrl}
          onClose={() => setEdit(null)}
          onError={a.setError}
        />
      )}
    </>
  );
}
