import { useState } from "react";
import { Pin, X, Globe, Volume2, Moon, ExternalLink } from "lucide-react";
import { activateTab } from "../lib/browser";
import { domain } from "../lib/model";
export function TabList({
  tabs,
  run,
  limit,
  editable = true,
}: {
  tabs: chrome.tabs.Tab[];
  run: (work: () => Promise<unknown>, success?: string) => void;
  limit?: number;
  editable?: boolean;
}) {
  const [visible, setVisible] = useState(100);
  const shown = tabs.slice(0, limit ?? visible);
  return (
    <>
      <div className="tab-list">
        {shown.map((tab) => (
          <div
            className={`tab-row ${tab.active ? "is-active" : ""}`}
            key={tab.id}
          >
            <button
              className="tab-link"
              onClick={() => run(() => activateTab(tab))}
            >
              <span className="site-icon">
                <Globe size={16} />
              </span>
              <span className="tab-copy">
                <strong>{tab.title || "Untitled tab"}</strong>
                <small>{domain(tab.url ?? "")}</small>
              </span>
              {tab.audible && <Volume2 size={14} aria-label="Playing audio" />}
              {tab.discarded && <Moon size={14} aria-label="Discarded" />}
              {tab.pinned && !editable && <Pin size={14} />}
            </button>
            {editable && (
              <div className="tab-actions">
                <button
                  className="icon-button"
                  aria-label={
                    tab.pinned ? `Unpin ${tab.title}` : `Pin ${tab.title}`
                  }
                  onClick={() =>
                    run(() =>
                      chrome.tabs.update(tab.id!, { pinned: !tab.pinned }),
                    )
                  }
                >
                  <Pin size={14} fill={tab.pinned ? "currentColor" : "none"} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Close ${tab.title}`}
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
        ))}
      </div>
      {!limit && tabs.length > visible && (
        <button
          className="secondary full"
          onClick={() => setVisible((v) => v + 100)}
        >
          Show next {Math.min(100, tabs.length - visible)} tabs
        </button>
      )}
    </>
  );
}
