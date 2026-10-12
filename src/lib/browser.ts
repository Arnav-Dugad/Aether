import {
  configSchema,
  defaults,
  safeUrl,
  serializeTabs,
  type Config,
  type SavedTab,
} from "./model";
import { db } from "./db";
export const installed = typeof chrome !== "undefined" && !!chrome.runtime?.id;
export async function getConfig(): Promise<Config> {
  if (!installed) return defaults;
  const data = await chrome.storage.local.get("config");
  const parsed = configSchema.safeParse(data.config ?? {});
  return parsed.success ? parsed.data : defaults;
}
export async function setConfig(config: Config): Promise<void> {
  if (installed)
    await chrome.storage.local.set({ config: configSchema.parse(config) });
}
export async function getTabs(): Promise<chrome.tabs.Tab[]> {
  return installed
    ? (await chrome.tabs.query({})).filter((t) => !t.incognito)
    : [];
}
export async function activateTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}
export async function openUrl(value: string): Promise<void> {
  const url = safeUrl(value);
  if (!url) throw new Error("Only http and https links can be opened.");
  if (installed) await chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
export async function restoreTabs(tabs: SavedTab[]): Promise<number> {
  if (!installed) throw new Error("Install Aether to restore browser tabs.");
  const groups = new Map<number, SavedTab[]>();
  for (const tab of tabs) {
    if (!safeUrl(tab.url)) continue;
    groups.set(tab.window, [...(groups.get(tab.window) ?? []), tab]);
  }
  let opened = 0;
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const win = await chrome.windows.create({ url: first.url, focused: false });
    if (!win?.id)
      throw new Error("The browser could not create a restoration window.");
    const initial = win.tabs?.[0];
    if (initial?.id !== undefined && first.pinned)
      await chrome.tabs.update(initial.id, { pinned: true });
    opened++;
    for (const tab of group.slice(1)) {
      await chrome.tabs.create({
        windowId: win.id,
        url: tab.url,
        pinned: tab.pinned,
        active: false,
      });
      opened++;
    }
  }
  return opened;
}
export async function saveSession(name: string): Promise<void> {
  const tabs = serializeTabs(await getTabs());
  if (!tabs.length) throw new Error("No regular web tabs to save.");
  await db.sessions.add({
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 80) || "Browser session",
    tabs,
    createdAt: Date.now(),
  });
}
export async function permission(
  name: "bookmarks" | "history" | "search",
): Promise<boolean> {
  if (!installed) return false;
  return (
    (await chrome.permissions.contains({ permissions: [name] })) ||
    (await chrome.permissions.request({ permissions: [name] }))
  );
}
export function center(): void {
  if (installed)
    void chrome.tabs.create({ url: chrome.runtime.getURL("/app.html") });
}
export async function sidePanel(): Promise<void> {
  if (!installed) return;
  if (chrome.sidePanel?.open) {
    const win = await chrome.windows.getCurrent();
    if (win.id === undefined)
      throw new Error("No browser window is available.");
    await chrome.sidePanel.open({ windowId: win.id });
  } else
    await chrome.windows.create({
      url: chrome.runtime.getURL("/sidepanel.html"),
      type: "popup",
      width: 420,
      height: 760,
    });
}
export function download(
  name: string,
  content: string,
  type = "application/json",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
