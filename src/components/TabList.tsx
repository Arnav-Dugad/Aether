import {
  Pin,
  X,
  Globe,
  Volume2,
  Moon,
  ExternalLink,
  Star,
  Shield,
  Pencil,
} from "lucide-react";
import { activateTab } from "../lib/browser";
import { domain, type TabMeta } from "../lib/model";
import { metadataKey, updateTabMeta } from "../lib/tabActions";
export interface TabRowProps {
  tab: chrome.tabs.Tab;
  run: (work: () => Promise<unknown>, success?: string) => void;
  editable?: boolean;
  metadata?: TabMeta;
  selected?: boolean;
  onToggle?: (id: number) => void;
  onEdit?: (tab: chrome.tabs.Tab) => void;
  card?: boolean;
}
export function TabRow({
  tab,
  run,
  editable = true,
  metadata,
  selected = false,
  onToggle,
  onEdit,
  card = false,
}: TabRowProps) {
  const label = metadata?.label || tab.title || "Untitled tab";
  const key = metadataKey(tab.url);
  return (
    <div
      className={`tab-row ${card ? "tab-card" : ""} ${tab.active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
    >
      {onToggle && (
        <input
          className="tab-select"
          type="checkbox"
          aria-label={`Select ${label}`}
          disabled={!key}
          checked={selected}
          onChange={() => onToggle(tab.id!)}
        />
      )}
      <button
        className="tab-link"
        data-tab-link
        onClick={() => run(() => activateTab(tab))}
      >
        <span className="site-icon">
          <Globe size={16} />
        </span>
        <span className="tab-copy">
          <strong>{label}</strong>
          <small>{domain(tab.url ?? "")}</small>
        </span>
        {tab.audible && <Volume2 size={14} aria-label="Playing audio" />}
        {tab.discarded && <Moon size={14} aria-label="Discarded" />}
        {tab.pinned && !editable && <Pin size={14} />}
      </button>
      {editable && (
        <div className="tab-actions">
          {onEdit && key && (
            <>
              <button
                className="icon-button meta-action"
                aria-label={`${metadata?.favorite ? "Unfavorite" : "Favorite"} ${label}`}
                onClick={() =>
                  run(() =>
                    updateTabMeta(key, { favorite: !metadata?.favorite }),
                  )
                }
              >
                <Star
                  size={14}
                  fill={metadata?.favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                className={`icon-button meta-action ${metadata?.protected ? "protected-tab" : ""}`}
                aria-label={`${metadata?.protected ? "Unprotect" : "Protect"} ${label}`}
                title="Protected URLs are excluded from automatic duplicate cleanup and bulk closing/discarding"
                onClick={() =>
                  run(() =>
                    updateTabMeta(key, { protected: !metadata?.protected }),
                  )
                }
              >
                <Shield size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Edit label for ${label}`}
                onClick={() => onEdit(tab)}
              >
                <Pencil size={14} />
              </button>
            </>
          )}
          <button
            className="icon-button"
            aria-label={`${tab.pinned ? "Unpin" : "Pin"} ${tab.title}`}
            onClick={() =>
              run(() => chrome.tabs.update(tab.id!, { pinned: !tab.pinned }))
            }
          >
            <Pin size={14} fill={tab.pinned ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label={`Close ${tab.title}`}
            disabled={metadata?.protected}
            title={
              metadata?.protected
                ? "Unprotect this URL before closing it from Aether"
                : undefined
            }
            onClick={() =>
              run(
                () => chrome.tabs.remove(tab.id!),
                "Tab closed. Recover it in Recently closed.",
              )
            }
          >
            <X size={15} />
          </button>
        </div>
      )}
      {!editable && <ExternalLink size={14} />}
    </div>
  );
}
export function TabList({
  tabs,
  run,
  limit,
  editable = true,
}: {
  tabs: chrome.tabs.Tab[];
  run: TabRowProps["run"];
  limit?: number;
  editable?: boolean;
}) {
  return (
    <div className="tab-list">
      {tabs.slice(0, limit ?? 100).map((tab) => (
        <TabRow key={tab.id} tab={tab} run={run} editable={editable} />
      ))}
      {!limit && tabs.length > 100 && (
        <p className="caption">
          Use the Tabs view to search and manage all {tabs.length} tabs.
        </p>
      )}
    </div>
  );
}
