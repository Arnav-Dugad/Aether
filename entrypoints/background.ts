import { defineBackground } from "wxt/utils/define-background";
import { db } from "../src/lib/db";
import { getConfig, getTabs, saveSession, setConfig } from "../src/lib/browser";
import {
  domain,
  safeUrl,
  mergeConfig,
  type FocusState,
} from "../src/lib/model";
import { executeTabAction } from "../src/lib/tabActions";
import { activitySlices, type ActiveState } from "../src/lib/activity";
export default defineBackground(() => {
  let queue = Promise.resolve();
  function reconcile(reset = false) {
    queue = queue
      .then(async () => {
        const now = Date.now();
        const config = await getConfig();
        const data = await chrome.storage.local.get(["activeState", "focus"]);
        const previous = data.activeState as ActiveState | undefined;
        if (config.tracking && !reset) {
          for (const slice of activitySlices(previous ?? null, now)) {
            const id = `${slice.day}|${slice.domain}`;
            await db.transaction("rw", db.activity, async () => {
              const row = await db.activity.get(id);
              await db.activity.put({
                id,
                ...slice,
                seconds: (row?.seconds ?? 0) + slice.seconds,
              });
            });
          }
        }
        let activeDomain: string | null = null;
        if (
          config.tracking &&
          (await chrome.idle.queryState(60)) === "active"
        ) {
          const windows = await chrome.windows.getAll();
          const win = windows.find((w) => w.focused && !w.incognito);
          if (win) {
            const [tab] = await chrome.tabs.query({
              windowId: win.id,
              active: true,
            });
            if (tab?.url && !tab.incognito && safeUrl(tab.url))
              activeDomain = domain(tab.url);
          }
        }
        await chrome.storage.local.set({
          activeState: { at: now, domain: activeDomain },
        });
        const focus = data.focus as FocusState | undefined;
        if (focus && now >= focus.endsAt) {
          await db.focusHistory.put({
            id: String(focus.startedAt),
            startedAt: focus.startedAt,
            duration: (focus.endsAt - focus.startedAt) / 1000,
            goal: focus.goal,
          });
          await chrome.storage.local.remove("focus");
          await chrome.action.setBadgeText({ text: "✓" });
        }
      })
      .catch(() => {
        /* Reconcile on the next event; do not stop the event queue. */
      });
  }
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.alarms.create("tick", { periodInMinutes: 1 });
    void chrome.alarms.create("snapshot", { periodInMinutes: 15 });
    reconcile(true);
  });
  chrome.runtime.onStartup.addListener(() => {
    void chrome.alarms.create("tick", { periodInMinutes: 1 });
    void chrome.alarms.create("snapshot", { periodInMinutes: 15 });
    reconcile(true);
  });
  chrome.tabs.onRemoved.addListener((id) => {
    queue = queue
      .then(async () => {
        const data = await chrome.storage.session.get("tabAssignments");
        const assignments = (data.tabAssignments ?? {}) as Record<
          string,
          string
        >;
        delete assignments[String(id)];
        await chrome.storage.session.set({ tabAssignments: assignments });
      })
      .catch(() => {});
  });
  chrome.tabs.onActivated.addListener(() => reconcile());
  chrome.tabs.onUpdated.addListener((_id, change) => {
    if (change.url) reconcile();
  });
  chrome.windows.onFocusChanged.addListener(() => reconcile());
  chrome.idle.onStateChanged.addListener(() => reconcile());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.config) reconcile(true);
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    reconcile();
    if (alarm.name === "snapshot")
      queue = queue
        .then(async () => {
          const config = await getConfig();
          if (!config.autoSnapshot) return;
          const tabs = await getTabs();
          if (!tabs.some((t) => t.url && safeUrl(t.url))) return;
          const latest = await db.sessions.orderBy("createdAt").last();
          const urls = tabs
            .filter((t) => t.url && safeUrl(t.url))
            .map((t) => t.url)
            .sort()
            .join("\n");
          if (
            latest &&
            latest.tabs
              .map((t) => t.url)
              .sort()
              .join("\n") === urls
          )
            return;
          await saveSession("Automatic snapshot");
          const old = await db.sessions
            .orderBy("createdAt")
            .reverse()
            .offset(100)
            .primaryKeys();
          await db.sessions.bulkDelete(old);
        })
        .catch(() => {});
  });

  chrome.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        !["CLEAR_DATA", "TAB_ACTION", "PATCH_CONFIG"].includes(
          String(message.type),
        )
      )
        return false;
      if (
        sender.id !== chrome.runtime.id ||
        !sender.url?.startsWith(chrome.runtime.getURL("/"))
      )
        return false;
      queue = queue
        .then(async () => {
          if (message.type === "PATCH_CONFIG") {
            const config = mergeConfig(
              await getConfig(),
              "patch" in message ? message.patch : null,
            );
            await setConfig(config);
            sendResponse({ ok: true, config });
            return;
          }
          if (message.type === "TAB_ACTION") {
            const result = await executeTabAction(
              "action" in message ? message.action : null,
            );
            sendResponse({ ok: true, result });
            return;
          }
          await chrome.alarms.clear("focus");
          await db.transaction("rw", db.tables, async () => {
            for (const table of db.tables) await table.clear();
          });
          await chrome.storage.local.clear();
          await chrome.storage.session.clear();
          await chrome.action.setBadgeText({ text: "" });
          sendResponse({ ok: true });
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not clear local data.",
          });
        });
      return true;
    },
  );
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-command-center")
      void chrome.tabs.create({
        url: chrome.runtime.getURL("/app.html#command"),
      });
  });
});
