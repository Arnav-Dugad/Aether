import { useState } from "react";
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
} from "lucide-react";
import { Modal } from "./ui";
import { activateTab, saveSession } from "../lib/browser";
import type { FeatureProps } from "../features/types";
export function CommandPalette({
  a,
  run,
  navigate,
  onClose,
}: FeatureProps & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const commands = [
    {
      id: "tabs",
      title: "Manage tabs",
      detail: "Go to tabs",
      icon: Layers,
      action: () => navigate?.("tabs"),
    },
    {
      id: "workspaces",
      title: "Open workspaces",
      detail: "Saved spaces",
      icon: Briefcase,
      action: () => navigate?.("workspaces"),
    },
    {
      id: "save",
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
      id: "notes",
      title: "Capture a note",
      detail: "Open notes",
      icon: NotebookPen,
      action: () => navigate?.("notes"),
    },
    {
      id: "focus",
      title: "Focus timer",
      detail: "Make room for deep work",
      icon: Moon,
      action: () => navigate?.("focus"),
    },
    {
      id: "analytics",
      title: "Activity insights",
      detail: "Real local activity",
      icon: BarChart3,
      action: () => navigate?.("analytics"),
    },
    {
      id: "settings",
      title: "Appearance & settings",
      detail: "Make Aether yours",
      icon: Settings,
      action: () => navigate?.("settings"),
    },
    ...a.tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      title: tab.title || "Untitled tab",
      detail: tab.url ?? "Open tab",
      icon: ArrowUpRight,
      action: () => run(() => activateTab(tab)),
    })),
  ]
    .filter((item) =>
      query
        .toLowerCase()
        .split(/\s+/)
        .every((term) =>
          `${item.title} ${item.detail}`.toLowerCase().includes(term),
        ),
    )
    .slice(0, 80);
  function execute(index: number) {
    const item = commands[index];
    if (!item) return;
    item.action();
    onClose();
  }
  return (
    <Modal title="Command search" onClose={onClose}>
      <div className="palette-search">
        <Search size={19} />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Where would you like to go?"
          aria-label="Search commands and tabs"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={
            commands[active] ? `command-${commands[active]!.id}` : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const next =
                e.key === "ArrowDown"
                  ? Math.min(active + 1, commands.length - 1)
                  : Math.max(active - 1, 0);
              setActive(next);
              document
                .getElementById(`command-${commands[next]?.id}`)
                ?.scrollIntoView({ block: "nearest" });
            }
            if (e.key === "Enter") {
              e.preventDefault();
              execute(active);
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div
        className="command-results"
        id="command-results"
        role="listbox"
        aria-label="Commands and tabs"
      >
        {commands.map((item, index) => (
          <button
            key={item.id}
            id={`command-${item.id}`}
            role="option"
            aria-selected={index === active}
            className={`command-item ${index === active ? "selected" : ""}`}
            onMouseEnter={() => setActive(index)}
            onClick={() => execute(index)}
          >
            <item.icon size={18} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            {index === active && <kbd>↵</kbd>}
          </button>
        ))}
        {commands.length === 0 && (
          <p className="empty">No commands or tabs match “{query}”.</p>
        )}
      </div>
      <footer className="palette-footer">
        <span>
          <Command size={13} /> Aether
        </span>
        <span>↑↓ navigate · ↵ open</span>
      </footer>
    </Modal>
  );
}
