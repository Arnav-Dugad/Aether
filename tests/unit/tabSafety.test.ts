import { expect, it } from "vitest";
import {
  closeCandidates,
  discardCandidates,
  metadataKey,
} from "../../src/lib/tabActions";
import { queryTabs, groupedTabRows } from "../../src/lib/tabQuery";
import { visibleRange } from "../../src/components/VirtualList";
import { backupSchema, noteSchema, workspaceSchema } from "../../src/lib/model";
const base = {
  windowId: 1,
  index: 0,
  active: false,
  highlighted: false,
  pinned: false,
  incognito: false,
  frozen: false,
  selected: false,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
};
const tab = (
  id: number,
  extra: Partial<chrome.tabs.Tab> = {},
): chrome.tabs.Tab => ({
  ...base,
  id,
  title: `Tab ${id}`,
  url: `https://site${id}.test/`,
  ...extra,
});
const metadata = [
  {
    url: "https://site2.test/",
    label: "My work",
    favorite: true,
    protected: true,
    updatedAt: 1,
  },
];
it("keeps protected, active, pinned, audible, private and internal tabs by default", () => {
  const tabs = [
    tab(1),
    tab(2),
    tab(3, { active: true }),
    tab(4, { pinned: true }),
    tab(5, { audible: true }),
    tab(6, { incognito: true }),
    tab(7, { url: "chrome://settings" }),
  ];
  expect(closeCandidates(tabs, metadata).map((t) => t.id)).toEqual([1]);
  expect(
    closeCandidates(tabs, metadata, {
      includePinned: true,
      includeActive: true,
      includeAudible: true,
    }).map((t) => t.id),
  ).toEqual([1, 3, 4, 5]);
  expect(
    discardCandidates(
      [
        ...tabs,
        tab(8, { autoDiscardable: false }),
        tab(9, { discarded: true }),
      ],
      metadata,
    ).map((t) => t.id),
  ).toEqual([1]);
});
it("protection and labels cover fragment copies while preserving query differences", () => {
  expect(metadataKey("https://site2.test/#part")).toBe(
    metadataKey("https://site2.test/"),
  );
  expect(metadataKey("https://site2.test/?q=1")).not.toBe(
    metadataKey("https://site2.test/"),
  );
  expect(metadataKey("javascript:bad()")).toBeNull();
});
it("filters by custom label, favorite and live workspace ownership", () => {
  const work = workspaceSchema.parse({
    id: "work",
    name: "Research",
    color: "#007aff",
    createdAt: 1,
    tabs: [],
  });
  const options = {
    query: "my work",
    filter: "favorites",
    sort: "browser" as const,
    windowId: null,
    workspaceId: "work",
    assignments: { "2": "work" },
    workspaces: [work],
  };
  expect(
    queryTabs([tab(1), tab(2)], metadata, options).map((t) => t.id),
  ).toEqual([2]);
  expect(
    queryTabs([tab(2)], metadata, {
      ...options,
      query: "",
      filter: "all",
      workspaceId: "unassigned",
      workspaces: [{ ...work, archived: true }],
    }),
  ).toHaveLength(1);
});
it("creates honest domain and window group summaries", () => {
  const rows = groupedTabRows(
    [tab(1), tab(2, { url: "https://site1.test/a" }), tab(3, { windowId: 2 })],
    "domains",
  );
  expect(rows.filter((r) => r.kind === "heading")).toEqual([
    { kind: "heading", name: "site1.test", count: 2 },
    { kind: "heading", name: "site3.test", count: 1 },
  ]);
});
it("limits rendered ranges for 1000 tabs and handles the end of a list", () => {
  expect(visibleRange(1000, 560, 66, 0)).toEqual({ start: 0, end: 14 });
  const range = visibleRange(1000, 560, 66, 65400);
  expect(range.end).toBe(1000);
  expect(range.end - range.start).toBeLessThan(25);
});
it("accepts legacy backups and rejects malformed new note and navigation data", () => {
  const backup = backupSchema.parse({
    version: 1,
    config: {},
    workspaces: [],
    sessions: [],
    notes: [],
  });
  expect(backup.tabMeta).toEqual([]);
  expect(
    noteSchema.safeParse({
      id: "x",
      title: "x",
      body: "",
      done: false,
      updatedAt: 1,
      dueDate: "2026-02-30",
    }).success,
  ).toBe(false);
  expect(
    backupSchema.safeParse({
      version: 1,
      config: { surfaceViews: { app: "malicious-route" } },
      workspaces: [],
      sessions: [],
      notes: [],
    }).success,
  ).toBe(false);
});
