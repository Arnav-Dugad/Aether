import { useState } from "react";
import { Bookmark, History, ExternalLink, Shield } from "lucide-react";
import { Empty, Panel, SearchField } from "../components/ui";
import { openUrl, permission } from "../lib/browser";
import { domain } from "../lib/model";
import type { FeatureProps } from "./types";
interface LinkItem {
  id: string;
  title: string;
  url: string;
  date?: number;
}
export function Library({
  run,
  kind,
}: FeatureProps & { kind: "bookmarks" | "history" }) {
  const [items, setItems] = useState<LinkItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState("");
  async function load() {
    if (!(await permission(kind)))
      throw new Error(
        `${kind === "history" ? "History" : "Bookmarks"} permission was not granted.`,
      );
    if (kind === "history") {
      const rows = await chrome.history.search({
        text: query,
        startTime: Date.now() - 30 * 86400000,
        maxResults: 500,
      });
      setItems(
        rows
          .filter((r) => r.url?.startsWith("http"))
          .map((r) => ({
            id: r.id,
            title: r.title || domain(r.url!),
            url: r.url!,
            date: r.lastVisitTime,
          })),
      );
    } else {
      const tree = await chrome.bookmarks.getTree();
      const flat: LinkItem[] = [];
      function walk(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
        for (const node of nodes) {
          if (node.url?.startsWith("http"))
            flat.push({
              id: node.id,
              title: node.title || domain(node.url),
              url: node.url,
              date: node.dateAdded,
            });
          if (node.children) walk(node.children);
        }
      }
      walk(tree);
      setItems(flat);
    }
    setEnabled(true);
  }
  const filtered = items.filter((i) =>
    `${i.title} ${i.url}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={`Search ${kind}`}
        />
        <button className="secondary" onClick={() => run(load)}>
          {enabled ? "Refresh" : `Connect ${kind}`}
        </button>
      </div>
      <Panel
        title={
          kind === "history" ? "Your recent browsing" : "Your bookmark library"
        }
        label={
          kind === "history"
            ? "LAST 30 DAYS · UP TO 500 RESULTS"
            : "BROWSER BOOKMARKS"
        }
      >
        {!enabled ? (
          <Empty
            icon={<Shield />}
            title={`A little permission, a lot of clarity`}
            action={
              <button className="primary" onClick={() => run(load)}>
                Allow {kind} access
              </button>
            }
          >
            Aether asks your browser for permission first. Your {kind} stays on
            this device.
          </Empty>
        ) : filtered.length ? (
          filtered.slice(0, 500).map((item) => (
            <button
              className="library-row"
              key={item.id}
              onClick={() => run(() => openUrl(item.url))}
            >
              {kind === "bookmarks" ? (
                <Bookmark size={17} />
              ) : (
                <History size={17} />
              )}
              <span>
                <strong>{item.title}</strong>
                <small>
                  {domain(item.url)}{" "}
                  {item.date && `· ${new Date(item.date).toLocaleDateString()}`}
                </small>
              </span>
              <ExternalLink size={14} />
            </button>
          ))
        ) : (
          <Empty title="Nothing here just yet">
            {query
              ? "Try a different search. For history, Refresh queries the browser again."
              : `Your ${kind} will appear here.`}
          </Empty>
        )}
      </Panel>
    </>
  );
}
