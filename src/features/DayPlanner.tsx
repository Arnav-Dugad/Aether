import { useState } from "react";
import { ArrowUpRight, Check, Plus, Target } from "lucide-react";
import { Panel } from "../components/ui";
import { db } from "../lib/db";
import { localDay, noteSchema } from "../lib/model";
import type { FeatureProps } from "./types";

export function DayPlanner({ a, run, navigate }: FeatureProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const today = localDay(a.now);
  const scheduled = a.notes.filter(
    (note) =>
      note.dueDate &&
      note.dueDate <= today &&
      (!note.done || note.dueDate === today),
  );
  const sorted = [...scheduled].sort(
    (x, y) =>
      Number(x.done) - Number(y.done) ||
      Number(y.priority === "high") - Number(x.priority === "high") ||
      (x.dueDate ?? "").localeCompare(y.dueDate ?? ""),
  );
  const completed = scheduled.filter((note) => note.done).length;
  return (
    <Panel
      className="day-planner"
      title="Make today meaningful"
      label="YOUR DAILY PRIORITIES"
      action={
        <button
          className="icon-button"
          aria-label="Manage priorities in Notes"
          onClick={() => navigate?.("notes")}
        >
          <ArrowUpRight size={18} />
        </button>
      }
    >
      <div className="planner-progress">
        <Target size={16} />
        <span>
          {scheduled.length
            ? `${completed} of ${scheduled.length} complete`
            : "One small step is a great start"}
        </span>
        <progress
          aria-label="Daily priorities completed"
          value={completed}
          max={Math.max(1, scheduled.length)}
        />
      </div>
      <form
        className="priority-input"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || saving) return;
          const value = title;
          setSaving(true);
          run(async () => {
            try {
              await db.notes.add(
                noteSchema.parse({
                  id: crypto.randomUUID(),
                  title: value.trim(),
                  body: "",
                  updatedAt: Date.now(),
                  done: false,
                  priority: "high",
                  dueDate: today,
                }),
              );
              setTitle("");
            } finally {
              setSaving(false);
            }
          }, "Priority saved for today");
        }}
      >
        <input
          aria-label="New daily priority"
          placeholder="What matters most today?"
          maxLength={120}
          value={title}
          disabled={saving}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Add daily priority"
          disabled={!title.trim() || saving}
        >
          <Plus size={18} />
        </button>
      </form>
      <div className="priority-list">
        {sorted.slice(0, 5).map((note) => (
          <div
            className={`priority-row ${note.done ? "is-done" : ""}`}
            key={note.id}
          >
            <button
              className="priority-check"
              aria-label={`${note.done ? "Reopen" : "Complete"} priority ${note.title}`}
              aria-pressed={note.done}
              onClick={() =>
                run(async () => {
                  // Patch only changed fields, preserving any concurrent body edits.
                  const updated = await db.notes.update(note.id, {
                    done: !note.done,
                    updatedAt: Date.now(),
                  });
                  if (!updated)
                    throw new Error(
                      "This priority was removed. Refresh your view.",
                    );
                })
              }
            >
              {note.done && <Check size={13} />}
            </button>
            <span>
              <strong>{note.title || "Untitled priority"}</strong>
              <small>
                {note.dueDate! < today && !note.done ? "Overdue" : "Today"} ·{" "}
                {note.priority} priority
              </small>
            </span>
          </div>
        ))}
        {!scheduled.length && (
          <p className="planner-empty">
            Give your day a little direction. Priorities sync with your local
            notes.
          </p>
        )}
        {sorted.length > 5 && (
          <button className="text-button" onClick={() => navigate?.("notes")}>
            View {sorted.length - 5} more in Notes <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </Panel>
  );
}
