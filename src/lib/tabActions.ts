import { z } from "zod";
import { db } from "./db";
import { installed } from "./browser";
import { safeUrl, tabMetaSchema, type TabMeta } from "./model";

const ids = z
  .array(z.number().int().positive())
  .max(2000)
  .refine(
    (value) => new Set(value).size === value.length,
    "Tab IDs must be unique",
  );
export const tabActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pin"), ids, pinned: z.boolean() }),
  z.object({
    kind: z.literal("close"),
    ids,
    includePinned: z.boolean().default(false),
    includeActive: z.boolean().default(false),
    includeAudible: z.boolean().default(false),
  }),
  z.object({ kind: z.literal("discard"), ids }),
  z.object({
    kind: z.literal("move"),
    ids,
    windowId: z.number().int().positive().nullable(),
  }),
  z.object({
    kind: z.literal("group"),
    ids,
    title: z.string().min(1).max(80),
    color: z
      .enum([
        "grey",
        "blue",
        "red",
        "yellow",
        "green",
        "pink",
        "purple",
        "cyan",
        "orange",
      ])
      .default("blue"),
  }),
  z.object({ kind: z.literal("ungroup"), ids }),
  z.object({
    kind: z.literal("assign"),
    ids,
    workspaceId: z.string().max(160).nullable(),
  }),
  z.object({ kind: z.literal("undo") }),
]);
export type TabAction = z.input<typeof tabActionSchema>;
export interface ActionResult {
  changed: number;
  skipped: number;
  failed: number;
  message: string;
}
interface UndoTab {
  id: number;
  url: string;
  title: string;
  windowId: number;
  index: number;
  pinned: boolean;
  workspaceId?: string;
  group?: { id: number; title: string; color: `${chrome.tabGroups.Color}` };
}
export interface UndoAction {
  kind: "pin" | "close" | "move";
  label: string;
  at: number;
  tabs: UndoTab[];
}
export function metadataKey(url?: string): string | null {
  if (!url || !safeUrl(url)) return null;
  const value = new URL(url);
  value.hash = "";
  return value.href;
}
export function eligibleTabs(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
  return tabs.filter(
    (tab) => tab.id !== undefined && !tab.incognito && !!metadataKey(tab.url),
  );
}
export function isProtected(
  tab: chrome.tabs.Tab,
  metadata: TabMeta[],
): boolean {
  const key = metadataKey(tab.url);
  return metadata.some((row) => row.url === key && row.protected);
}
export function closeCandidates(
  tabs: chrome.tabs.Tab[],
  metadata: TabMeta[],
  options: {
    includePinned?: boolean;
    includeActive?: boolean;
    includeAudible?: boolean;
  } = {},
): chrome.tabs.Tab[] {
  return eligibleTabs(tabs).filter(
    (tab) =>
      !isProtected(tab, metadata) &&
      (options.includePinned || !tab.pinned) &&
      (options.includeActive || !tab.active) &&
      (options.includeAudible || !tab.audible),
  );
}
export function discardCandidates(
  tabs: chrome.tabs.Tab[],
  metadata: TabMeta[],
): chrome.tabs.Tab[] {
  return eligibleTabs(tabs).filter(
    (tab) =>
      !isProtected(tab, metadata) &&
      !tab.active &&
      !tab.pinned &&
      !tab.audible &&
      !tab.discarded &&
      tab.autoDiscardable !== false,
  );
}
export async function updateTabMeta(
  url: string,
  patch: Partial<Pick<TabMeta, "label" | "favorite" | "protected">>,
): Promise<void> {
  const key = metadataKey(url);
  if (!key) throw new Error("Only regular web pages support tab metadata.");
  await db.transaction("rw", db.tabMeta, async () => {
    const existing = await db.tabMeta.get(key);
    await db.tabMeta.put(
      tabMetaSchema.parse({
        url: key,
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      }),
    );
  });
}
export async function performTabAction(
  action: TabAction,
): Promise<ActionResult> {
  if (!installed) throw new Error("Install Aether to manage browser tabs.");
  const response = (await chrome.runtime.sendMessage({
    type: "TAB_ACTION",
    action,
  })) as { ok: boolean; result?: ActionResult; error?: string };
  if (!response?.ok || !response.result)
    throw new Error(response?.error || "The browser action could not finish.");
  return response.result;
}
export async function assignTabs(
  ids: number[],
  workspaceId: string | null,
): Promise<void> {
  const result = await performTabAction({
    kind: "assign",
    ids: [...new Set(ids)],
    workspaceId,
  });
  if (result.failed) throw new Error(result.message);
}
function snapshot(tab: chrome.tabs.Tab): UndoTab {
  return {
    id: tab.id!,
    url: tab.url!,
    title: tab.title ?? "",
    windowId: tab.windowId,
    index: tab.index,
    pinned: tab.pinned,
  };
}
function report(
  changed: number,
  skipped: number,
  failed: number,
): ActionResult {
  return {
    changed,
    skipped,
    failed,
    message: `${changed} changed${skipped ? ` · ${skipped} skipped` : ""}${failed ? ` · ${failed} failed` : ""}`,
  };
}
async function liveSelected(ids: number[]): Promise<chrome.tabs.Tab[]> {
  const requested = new Set(ids);
  return eligibleTabs(await chrome.tabs.query({})).filter((tab) =>
    requested.has(tab.id!),
  );
}
export async function executeTabAction(input: unknown): Promise<ActionResult> {
  const action = tabActionSchema.parse(input);
  if (action.kind === "undo") return undoLastAction();
  const tabs = await liveSelected(action.ids);
  const metadata = await db.tabMeta.toArray();
  let candidates = tabs;
  if (action.kind === "close")
    candidates = closeCandidates(tabs, metadata, action);
  if (action.kind === "discard") candidates = discardCandidates(tabs, metadata);
  if (action.kind === "group") candidates = tabs.filter((tab) => !tab.pinned);
  let changed = 0,
    failed = 0;
  const before: UndoTab[] = [];
  if (action.kind === "assign") {
    if (action.workspaceId) {
      const workspace = await db.workspaces.get(action.workspaceId);
      if (!workspace || workspace.archived || workspace.template)
        throw new Error(
          "Choose an active workspace, not an archive or template.",
        );
    }
    const data = await chrome.storage.session.get("tabAssignments");
    const assignments = (data.tabAssignments ?? {}) as Record<string, string>;
    for (const id of action.workspaceId === null
      ? action.ids
      : tabs.map((tab) => tab.id!)) {
      if (action.workspaceId) assignments[String(id)] = action.workspaceId;
      else delete assignments[String(id)];
    }
    await chrome.storage.session.set({ tabAssignments: assignments });
    return report(tabs.length, action.ids.length - tabs.length, 0);
  }
  if (action.kind === "group" || action.kind === "ungroup") {
    if (!chrome.tabs.group || !chrome.tabGroups)
      throw new Error("Native tab groups are unavailable in this browser.");
    for (const windowId of new Set(candidates.map((t) => t.windowId))) {
      const members = candidates
        .filter((t) => t.windowId === windowId)
        .map((t) => t.id!);
      if (!members.length) continue;
      try {
        if (action.kind === "group") {
          const id = await chrome.tabs.group({
            tabIds: members as [number, ...number[]],
          });
          await chrome.tabGroups.update(id, {
            title: action.title,
            color: action.color,
          });
        } else await chrome.tabs.ungroup(members as [number, ...number[]]);
        changed += members.length;
      } catch {
        failed += members.length;
      }
    }
    return report(changed, action.ids.length - candidates.length, failed);
  }
  const sessionData = await chrome.storage.session.get("tabAssignments");
  const assignments = (sessionData.tabAssignments ?? {}) as Record<
    string,
    string
  >;
  let targetWindow = action.kind === "move" ? action.windowId : null;
  for (const planned of candidates) {
    try {
      const tab = await chrome.tabs.get(planned.id!);
      if (tab.incognito || !metadataKey(tab.url)) continue;
      // Recheck safety immediately before each mutation; preview may be stale.
      if (
        action.kind === "close" &&
        !closeCandidates(
          [tab],
          [await db.tabMeta.get(metadataKey(tab.url)!)].filter(
            (row): row is TabMeta => !!row,
          ),
          action,
        ).length
      )
        continue;
      if (
        action.kind === "discard" &&
        !discardCandidates(
          [tab],
          [await db.tabMeta.get(metadataKey(tab.url)!)].filter(
            (row): row is TabMeta => !!row,
          ),
        ).length
      )
        continue;
      const saved = {
        ...snapshot(tab),
        windowId: planned.windowId,
        index: planned.index,
      };
      saved.workspaceId = assignments[String(tab.id)];
      if (tab.groupId >= 0 && chrome.tabGroups) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          saved.group = {
            id: group.id,
            title: group.title ?? "",
            color: group.color,
          };
        } catch {
          /* A disappearing group should not block a reviewed tab action. */
        }
      }
      if (action.kind === "pin") {
        if (tab.pinned === action.pinned) continue;
        await chrome.tabs.update(tab.id!, { pinned: action.pinned });
      } else if (action.kind === "close") await chrome.tabs.remove(tab.id!);
      else if (action.kind === "discard") await chrome.tabs.discard(tab.id!);
      else if (action.kind === "move") {
        if (targetWindow === null) {
          const win = await chrome.windows.create({
            tabId: tab.id!,
            focused: false,
          });
          if (win?.id === undefined)
            throw new Error("Could not create a window.");
          targetWindow = win.id;
        } else if (tab.windowId !== targetWindow) {
          const win = await chrome.windows.get(targetWindow);
          if (win.incognito)
            throw new Error(
              "Moving regular tabs into private windows is not supported.",
            );
          await chrome.tabs.move(tab.id!, {
            windowId: targetWindow,
            index: -1,
          });
        } else continue;
      }
      changed++;
      before.push(saved);
    } catch {
      failed++;
    }
  }
  if (
    before.length &&
    (action.kind === "pin" || action.kind === "close" || action.kind === "move")
  ) {
    const record: UndoAction = {
      kind: action.kind,
      label: `${action.kind === "pin" ? (action.pinned ? "Pin" : "Unpin") : action.kind === "close" ? "Close" : "Move"} ${changed} tabs`,
      at: Date.now(),
      tabs: before,
    };
    await chrome.storage.session.set({ bulkUndo: record });
  }
  return report(changed, action.ids.length - changed - failed, failed);
}
async function undoLastAction(): Promise<ActionResult> {
  const data = await chrome.storage.session.get("bulkUndo");
  const record = data.bulkUndo as UndoAction | undefined;
  if (
    !record ||
    !["pin", "close", "move"].includes(record.kind) ||
    !Array.isArray(record.tabs)
  )
    throw new Error("There is no tab action to undo in this browser session.");
  const windows = new Map<number, number>();
  let changed = 0,
    failed = 0;
  const pending: UndoTab[] = [];
  const failures: string[] = [];
  const restored: { saved: UndoTab; id: number; windowId: number }[] = [];
  for (const saved of [...record.tabs].sort((a, b) => a.index - b.index)) {
    try {
      if (!metadataKey(saved.url)) continue;
      let restoredId = saved.id;
      let restoredWindow = saved.windowId;
      if (record.kind === "pin") {
        const tab = await chrome.tabs.get(saved.id);
        if (tab.incognito) continue;
        await chrome.tabs.update(saved.id, { pinned: saved.pinned });
      } else {
        let destination = windows.get(saved.windowId);
        if (destination === undefined) {
          try {
            const existing = await chrome.windows.get(saved.windowId);
            if (existing.incognito) throw new Error("Private window");
            destination = existing.id;
          } catch {
            destination = undefined;
          }
        }
        if (record.kind === "close") {
          if (destination === undefined) {
            const win = await chrome.windows.create({
              url: saved.url,
              focused: false,
            });
            if (win?.id === undefined) throw new Error("Window unavailable");
            destination = win.id;
            const initial = win.tabs?.[0];
            if (initial?.id === undefined)
              throw new Error("Restored tab unavailable");
            restoredId = initial.id;
            if (initial?.id !== undefined && saved.pinned)
              await chrome.tabs.update(initial.id, { pinned: true });
          } else {
            const created = await chrome.tabs.create({
              windowId: destination,
              url: saved.url,
              index: saved.group ? -1 : saved.index,
              pinned: saved.pinned,
              active: false,
            });
            if (created.id === undefined)
              throw new Error("Restored tab unavailable");
            restoredId = created.id;
          }
        } else {
          const tab = await chrome.tabs.get(saved.id);
          if (tab.incognito) continue;
          if (destination === undefined) {
            const win = await chrome.windows.create({
              tabId: saved.id,
              focused: false,
            });
            if (win?.id === undefined) throw new Error("Window unavailable");
            destination = win.id;
          } else
            await chrome.tabs.move(saved.id, {
              windowId: destination,
              // Insert outside native groups, then restore group membership/order.
              index: -1,
            });
          await chrome.tabs.update(saved.id, { pinned: saved.pinned });
        }
        windows.set(saved.windowId, destination!);
        restoredWindow = destination!;
      }
      changed++;
      restored.push({ saved, id: restoredId, windowId: restoredWindow });
    } catch (error) {
      failed++;
      failures.push(error instanceof Error ? error.message : String(error));
      pending.push(saved);
    }
  }
  let groupWarning = false;
  const groups = new Map<
    string,
    { group: NonNullable<UndoTab["group"]>; windowId: number; ids: number[] }
  >();
  const session = await chrome.storage.session.get("tabAssignments");
  const assignments = (session.tabAssignments ?? {}) as Record<string, string>;
  for (const item of restored) {
    if (item.saved.workspaceId) {
      const workspace = await db.workspaces.get(item.saved.workspaceId);
      if (workspace && !workspace.archived && !workspace.template)
        assignments[String(item.id)] = workspace.id;
    }
    if (item.saved.group && !item.saved.pinned) {
      const key = `${item.windowId}:${item.saved.group.id}`;
      const group = groups.get(key) ?? {
        group: item.saved.group,
        windowId: item.windowId,
        ids: [],
      };
      group.ids.push(item.id);
      groups.set(key, group);
    }
  }
  await chrome.storage.session.set({ tabAssignments: assignments });
  for (const item of groups.values()) {
    try {
      let groupId: number | undefined;
      try {
        const current = await chrome.tabGroups.get(item.group.id);
        if (current.windowId === item.windowId) groupId = current.id;
      } catch {
        /* Original group may have been removed with its last tab. */
      }
      const id = await chrome.tabs.group({
        tabIds: item.ids as [number, ...number[]],
        ...(groupId !== undefined
          ? { groupId }
          : { createProperties: { windowId: item.windowId } }),
      });
      await chrome.tabGroups.update(id, {
        title: item.group.title,
        color: item.group.color,
      });
    } catch {
      groupWarning = true;
    }
  }
  let positionWarning = false;
  for (const item of restored) {
    if (record.kind !== "move" && !item.saved.group) continue;
    try {
      await chrome.tabs.move(item.id, { index: item.saved.index });
    } catch {
      positionWarning = true;
    }
  }
  if (pending.length)
    await chrome.storage.session.set({
      bulkUndo: { ...record, tabs: pending },
    });
  else await chrome.storage.session.remove("bulkUndo");
  const result = report(changed, record.tabs.length - changed - failed, failed);
  if (failures.length) result.message += ` · ${failures[0]}`;
  if (groupWarning)
    result.message += " · some native groups could not be restored";
  if (positionWarning)
    result.message += " · some tab positions could not be restored";
  return result;
}
