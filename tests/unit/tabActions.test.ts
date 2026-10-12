import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "../../src/lib/db";
import { executeTabAction } from "../../src/lib/tabActions";
import { workspaceSchema } from "../../src/lib/model";
let tabs: chrome.tabs.Tab[];
let session: Record<string, unknown>;
let groups: Map<
  number,
  { id: number; windowId: number; title: string; color: string }
>;
let nextId: number;
let missing: number | null;
const make = (
  id: number,
  extra: Partial<chrome.tabs.Tab> = {},
): chrome.tabs.Tab => ({
  id,
  windowId: 1,
  index: id - 1,
  title: `Page ${id}`,
  url: `https://page${id}.test/`,
  active: false,
  pinned: false,
  incognito: false,
  highlighted: false,
  selected: false,
  discarded: false,
  frozen: false,
  autoDiscardable: true,
  groupId: -1,
  ...extra,
});
beforeEach(async () => {
  await Promise.all([db.tabMeta.clear(), db.workspaces.clear()]);
  tabs = [make(1), make(2), make(3)];
  session = {};
  groups = new Map();
  nextId = 100;
  missing = null;
  vi.stubGlobal("chrome", {
    tabs: {
      query: async () => structuredClone(tabs),
      get: async (id: number) => {
        if (id === missing) throw new Error("Closed elsewhere");
        const t = tabs.find((t) => t.id === id);
        if (!t) throw new Error("No tab");
        return structuredClone(t);
      },
      update: async (id: number, patch: Partial<chrome.tabs.Tab>) => {
        const t = tabs.find((t) => t.id === id)!;
        Object.assign(t, patch);
        if (patch.pinned) t.groupId = -1;
        return t;
      },
      remove: async (id: number) => {
        tabs = tabs.filter((t) => t.id !== id);
      },
      discard: async (id: number) => {
        const t = tabs.find((t) => t.id === id)!;
        t.discarded = true;
        return t;
      },
      create: async (options: {
        url: string;
        windowId?: number;
        pinned?: boolean;
        index?: number;
      }) => {
        const t = make(nextId++, {
          url: options.url,
          windowId: options.windowId ?? 1,
          pinned: options.pinned ?? false,
          index: options.index ?? tabs.length,
        });
        tabs.push(t);
        return t;
      },
      move: async (
        id: number,
        options: { windowId?: number; index: number },
      ) => {
        const t = tabs.find((t) => t.id === id)!;
        if (options.windowId !== undefined && options.windowId !== t.windowId) {
          t.windowId = options.windowId;
          t.groupId = -1;
        }
        t.index = options.index;
        return t;
      },
      group: async (options: {
        tabIds: number[];
        groupId?: number;
        createProperties?: { windowId: number };
      }) => {
        const id = options.groupId ?? nextId++;
        const windowId =
          options.createProperties?.windowId ??
          tabs.find((t) => t.id === options.tabIds[0])!.windowId;
        if (!groups.has(id))
          groups.set(id, { id, windowId, title: "", color: "grey" });
        for (const tab of tabs.filter((t) => options.tabIds.includes(t.id!)))
          tab.groupId = id;
        return id;
      },
      ungroup: async (ids: number[]) => {
        for (const tab of tabs.filter((t) => ids.includes(t.id!)))
          tab.groupId = -1;
      },
    },
    windows: {
      get: async (id: number) => ({ id, incognito: false }),
      create: async (options: { tabId?: number; url?: string }) => {
        const id = nextId++;
        let tab: chrome.tabs.Tab;
        if (options.tabId) {
          tab = tabs.find((t) => t.id === options.tabId)!;
          tab.windowId = id;
          tab.groupId = -1;
        } else {
          tab = make(nextId++, { windowId: id, url: options.url! });
          tabs.push(tab);
        }
        return { id, tabs: [tab] };
      },
    },
    tabGroups: {
      get: async (id: number) => {
        const group = groups.get(id);
        if (!group) throw new Error("No group");
        return group;
      },
      update: async (id: number, patch: object) =>
        Object.assign(groups.get(id)!, patch),
    },
    storage: {
      session: {
        get: async () => structuredClone(session),
        set: async (data: Record<string, unknown>) => {
          Object.assign(session, structuredClone(data));
        },
        remove: async (key: string) => {
          delete session[key];
        },
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("reports a disappearing tab and only records mutations that actually succeeded", async () => {
  missing = 2;
  const result = await executeTabAction({
    kind: "pin",
    ids: [1, 2, 3],
    pinned: true,
  });
  expect(result).toMatchObject({ changed: 2, failed: 1, skipped: 0 });
  expect(
    (session.bulkUndo as { tabs: { id: number }[] }).tabs.map((t) => t.id),
  ).toEqual([1, 3]);
});
it("keeps protected tabs and restores closed metadata plus live workspace ownership", async () => {
  await db.tabMeta.put({
    url: "https://page1.test/",
    label: "",
    favorite: false,
    protected: true,
    updatedAt: 1,
  });
  await db.workspaces.add(
    workspaceSchema.parse({
      id: "work",
      name: "Work",
      color: "#007aff",
      tabs: [],
      createdAt: 1,
    }),
  );
  session.tabAssignments = { "2": "work" };
  const closed = await executeTabAction({ kind: "close", ids: [1, 2, 3] });
  expect(closed.changed).toBe(2);
  expect(tabs.map((t) => t.id)).toEqual([1]);
  const undo = await executeTabAction({ kind: "undo" });
  expect(undo.changed).toBe(2);
  expect(tabs.map((t) => t.url).sort()).toEqual([
    "https://page1.test/",
    "https://page2.test/",
    "https://page3.test/",
  ]);
  const recreated = tabs.find((t) => t.url === "https://page2.test/")!;
  expect(
    (session.tabAssignments as Record<string, string>)[String(recreated.id)],
  ).toBe("work");
  expect(session.bulkUndo).toBeUndefined();
});
it("move undo restores original native group and window", async () => {
  groups.set(8, { id: 8, windowId: 1, title: "Research", color: "blue" });
  tabs[1]!.groupId = 8;
  await executeTabAction({ kind: "move", ids: [2], windowId: null });
  expect(tabs[1]!.windowId).not.toBe(1);
  await executeTabAction({ kind: "undo" });
  expect(tabs[1]!.windowId).toBe(1);
  expect(tabs[1]!.groupId).toBe(8);
});
it("refuses private-window destinations and assignments to archived or missing workspaces", async () => {
  await expect(
    executeTabAction({ kind: "assign", ids: [1], workspaceId: "missing" }),
  ).rejects.toThrow("active workspace");
  await db.workspaces.add(
    workspaceSchema.parse({
      id: "archive",
      name: "Archived",
      color: "#007aff",
      tabs: [],
      createdAt: 1,
      archived: true,
    }),
  );
  await expect(
    executeTabAction({ kind: "assign", ids: [1], workspaceId: "archive" }),
  ).rejects.toThrow("active workspace");
  session.tabAssignments = { "900": "old" };
  await executeTabAction({ kind: "assign", ids: [900], workspaceId: null });
  expect(session.tabAssignments).toEqual({});
});

it("rejoins native group before inserting into its original middle position", async () => {
  groups.set(8, { id: 8, windowId: 1, title: "Research", color: "blue" });
  for (const tab of tabs) tab.groupId = 8;
  await executeTabAction({ kind: "move", ids: [2], windowId: null });
  const move = chrome.tabs.move;
  const guarded = vi
    .spyOn(chrome.tabs, "move")
    .mockImplementation(async (...args) => {
      const [id, options] = args;
      const tabId = Array.isArray(id) ? id[0] : id;
      const tab = tabs.find((t) => t.id === tabId)!;
      if (
        options.windowId !== undefined &&
        options.windowId !== tab.windowId &&
        options.index >= 0
      )
        throw new Error("would disrupt group continuity");
      return move(id, options);
    });
  const result = await executeTabAction({ kind: "undo" });
  expect(result.failed).toBe(0);
  expect(tabs[1]!.windowId).toBe(1);
  expect(tabs[1]!.groupId).toBe(8);
  expect(tabs[1]!.index).toBe(1);
  expect(guarded).toHaveBeenNthCalledWith(1, 2, { windowId: 1, index: -1 });
  expect(guarded).toHaveBeenLastCalledWith(2, { index: 1 });
});
