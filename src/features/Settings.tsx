import { useState } from "react";
import {
  Download,
  Upload,
  Trash2,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { Field, Modal, Panel, Toggle } from "../components/ui";
import { backupSchema, type Config } from "../lib/model";
import { db } from "../lib/db";
import { download, installed } from "../lib/browser";
import type { FeatureProps } from "./types";
export function Settings({ a, run }: FeatureProps) {
  const themes: { value: Config["theme"]; title: string; icon: typeof Sun }[] =
    [
      { value: "light", title: "Light", icon: Sun },
      { value: "obsidian", title: "Obsidian", icon: Moon },
      { value: "graphite", title: "Graphite", icon: Moon },
      { value: "oled", title: "OLED", icon: Moon },
      { value: "system", title: "System", icon: Monitor },
    ];
  function patch(value: Partial<Config>) {
    run(() => a.patchConfig(value));
  }
  return (
    <div className="settings-columns">
      <Panel title="Make it feel like you" label="APPEARANCE">
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              className={`theme-choice ${theme.value === a.config.theme ? "selected" : ""}`}
              key={theme.value}
              aria-pressed={theme.value === a.config.theme}
              onClick={() => patch({ theme: theme.value })}
            >
              <span className={`theme-preview ${theme.value}`}>
                <theme.icon size={22} />
                <i />
              </span>
              {theme.title}
            </button>
          ))}
        </div>
        <Field label="Accent color">
          <div className="accent-options">
            {[
              "#007aff",
              "#5856d6",
              "#af52de",
              "#d12e50",
              "#b65d00",
              "#087f70",
            ].map((color) => (
              <button
                style={{ background: color }}
                className={a.config.accent === color ? "selected" : ""}
                key={color}
                aria-label={`Set accent ${color}`}
                aria-pressed={a.config.accent === color}
                onClick={() => patch({ accent: color })}
              />
            ))}
            <input
              aria-label="Custom accent color"
              type="color"
              value={a.config.accent}
              onChange={(e) => patch({ accent: e.target.value })}
            />
          </div>
        </Field>
        <Field label={`Frosted glass strength · ${a.config.glass}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={a.config.glass}
            onChange={(e) => patch({ glass: Number(e.target.value) })}
          />
        </Field>
        <p className="caption">
          Classic frosted glass: soft background blur, a matte tint, and subtle
          edges.
        </p>
        <Toggle
          label="Reduce transparency"
          detail="Use opaque surfaces for maximum clarity."
          checked={a.config.reducedTransparency}
          onChange={(value) => patch({ reducedTransparency: value })}
        />
        <Toggle
          label="High contrast"
          detail="Stronger text, borders, and selection states."
          checked={a.config.highContrast}
          onChange={(value) => patch({ highContrast: value })}
        />
        <Toggle
          label="Compact spacing"
          checked={a.config.compact}
          onChange={(value) => patch({ compact: value })}
        />
        <Toggle
          label="Reduce motion"
          detail="Keep the interface still. Your system motion preference is also respected."
          checked={a.config.reducedMotion}
          onChange={(value) => patch({ reducedMotion: value })}
        />
      </Panel>
      <div className="stack">
        <Panel title="The little details" label="PERSONALIZATION">
          <Field label="Greeting name">
            <input
              aria-label="Greeting name"
              maxLength={50}
              value={a.config.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Your name, if you like"
            />
          </Field>
          <Field label="Focus session length">
            <select
              value={a.config.focusMinutes}
              onChange={(e) => patch({ focusMinutes: Number(e.target.value) })}
            >
              {[15, 25, 45, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </Field>
          <Toggle
            label="Automatic snapshots"
            detail="Save changed web tabs every 15 minutes; retain the newest 100 snapshots."
            checked={a.config.autoSnapshot}
            onChange={(value) => patch({ autoSnapshot: value })}
          />
          <Field label="Daily focus goal">
            <select
              value={a.config.dailyFocusGoal}
              aria-label="Daily focus goal"
              onChange={(event) =>
                patch({ dailyFocusGoal: Number(event.target.value) })
              }
            >
              {[30, 60, 90, 120, 180, 240].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </Field>
        </Panel>
        <Panel title="Your dashboard" label="WIDGETS">
          <p className="caption">
            Show or hide widgets. Reorder them using the arrows.
          </p>
          {["tabs", "workspaces", "focus", "notes", "activity", "sessions"].map(
            (key) => (
              <div className="widget-setting" key={key}>
                <Toggle
                  label={key}
                  checked={a.config.widgets.includes(
                    key as Config["widgets"][number],
                  )}
                  onChange={(on) =>
                    patch({
                      widgets: on
                        ? [
                            ...a.config.widgets,
                            key as Config["widgets"][number],
                          ]
                        : a.config.widgets.filter((v) => v !== key),
                    })
                  }
                />
                {a.config.widgets.includes(
                  key as Config["widgets"][number],
                ) && (
                  <button
                    className="icon-button"
                    disabled={a.config.widgets[0] === key}
                    aria-label={`Move ${key} widget up`}
                    onClick={() => {
                      const widgets = [...a.config.widgets];
                      const index = widgets.indexOf(
                        key as Config["widgets"][number],
                      );
                      if (index > 0) {
                        [widgets[index - 1], widgets[index]] = [
                          widgets[index]!,
                          widgets[index - 1]!,
                        ];
                        patch({ widgets });
                      }
                    }}
                  >
                    ↑
                  </button>
                )}
              </div>
            ),
          )}
        </Panel>
        <Panel title="Keyboard & browser" label="CAPABILITIES">
          <p className="muted">
            ⌘/Ctrl K opens command search inside Aether. Ctrl Shift Space opens
            the command center where the browser permits it.
          </p>
          <button
            className="secondary"
            disabled={!installed}
            onClick={() =>
              run(() =>
                chrome.tabs.create({ url: "chrome://extensions/shortcuts" }),
              )
            }
          >
            <SlidersHorizontal size={15} />
            Browser shortcuts
          </button>
          <p className="caption">
            All preferences stay in local extension storage. Reduced motion
            follows your operating system.
          </p>
        </Panel>
      </div>
    </div>
  );
}
export function Privacy({ a, run }: FeatureProps) {
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<ReturnType<
    typeof backupSchema.parse
  > | null>(null);
  async function exportData() {
    const backup = {
      version: 1,
      config: a.config,
      workspaces: a.workspaces,
      sessions: a.sessions,
      notes: a.notes,
      tabMeta: a.tabMeta,
    };
    download("aether-backup.json", JSON.stringify(backup, null, 2));
  }
  return (
    <>
      <Panel
        title="Private by design"
        label="YOUR DATA. YOUR DEVICE."
        className="privacy-hero"
      >
        <ShieldCheck size={32} />
        <p>
          Workspaces, sessions, notes, and activity are stored locally. Aether
          has no accounts, telemetry, advertisements, or cloud synchronization.
        </p>
        <Toggle
          label="Local activity tracking"
          detail="Record domains and approximate foreground time. Incognito tabs are excluded."
          checked={a.config.tracking}
          onChange={(value) => run(() => a.patchConfig({ tracking: value }))}
        />
      </Panel>
      <Panel title="Keep a copy">
        <p className="muted">
          Back up settings, workspaces, sessions, notes, and tab
          labels/protection. Activity and completed focus history are excluded
          from this portable backup.
        </p>
        <div className="button-row">
          <button className="secondary" onClick={() => run(exportData)}>
            <Download size={16} />
            Export backup
          </button>
          <label className="secondary file-button">
            <Upload size={16} />
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import backup"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                run(async () => {
                  if (file.size > 10000000)
                    throw new Error("Backup exceeds the 10 MB limit.");
                  setPending(backupSchema.parse(JSON.parse(await file.text())));
                });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Panel>
      <Panel title="Optional browser access">
        <p className="muted">
          Bookmarks and history ask permission when you open those features.
          Release checks ask permission to contact the GitHub API. None of those
          connections is required for your dashboard.
        </p>
        <button
          className="secondary"
          onClick={() =>
            run(async () => {
              if (!installed) return;
              const all = await chrome.permissions.getAll();
              const optional = (all.permissions ?? []).filter((p) =>
                ["bookmarks", "history", "search"].includes(p),
              );
              if (optional.length || all.origins?.length)
                await chrome.permissions.remove({
                  permissions: optional,
                  origins: all.origins,
                });
            }, "Optional permissions revoked")
          }
        >
          Revoke optional permissions
        </button>
      </Panel>
      <Panel title="Start fresh">
        <p className="muted">
          Permanently delete all Aether data, including preferences and
          activity. Browser bookmarks and browsing history are unaffected.
        </p>
        <button className="danger" onClick={() => setDeleting(true)}>
          <Trash2 size={15} />
          Delete Aether data
        </button>
      </Panel>
      {pending && (
        <Modal title="Import backup?" onClose={() => setPending(null)}>
          <p>
            Add or replace {pending.workspaces.length} workspaces,{" "}
            {pending.sessions.length} sessions, and {pending.notes.length} notes
            with matching IDs. Appearance and settings will be replaced.
          </p>
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                await db.transaction(
                  "rw",
                  db.workspaces,
                  db.sessions,
                  db.notes,
                  db.tabMeta,
                  async () => {
                    await db.workspaces.bulkPut(pending.workspaces);
                    await db.sessions.bulkPut(pending.sessions);
                    await db.notes.bulkPut(pending.notes);
                    await db.tabMeta.bulkPut(pending.tabMeta);
                  },
                );
                await a.patchConfig(pending.config);
                setPending(null);
              }, "Backup imported")
            }
          >
            Import validated backup
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete all Aether data?"
          onClose={() => setDeleting(false)}
        >
          <p>This cannot be undone. Export a backup first if you need one.</p>
          <button
            className="danger"
            onClick={() =>
              run(async () => {
                if (installed) {
                  const result = (await chrome.runtime.sendMessage({
                    type: "CLEAR_DATA",
                  })) as { ok: boolean; error?: string };
                  if (!result.ok)
                    throw new Error(
                      result.error || "Could not clear local data.",
                    );
                } else {
                  await db.transaction("rw", db.tables, async () => {
                    for (const table of db.tables) await table.clear();
                  });
                }
                location.reload();
              })
            }
          >
            Permanently delete
          </button>
        </Modal>
      )}
    </>
  );
}
