import { useEffect, useState, useRef } from "react";
import { liveQuery } from "dexie";
import { db } from "./db";
import { getTabs, getConfig, installed, patchStoredConfig } from "./browser";
import {
  defaults,
  type Config,
  type Workspace,
  type Session,
  type Note,
  type Activity,
  type FocusState,
  type FocusRecord,
  type TabMeta,
} from "./model";
export function useAether() {
  const pendingConfig = useRef(0);
  const configRevision = useRef(0);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [config, updateConfig] = useState(defaults);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tabMeta, setTabMeta] = useState<TabMeta[]>([]);
  const [tabAssignments, setTabAssignments] = useState<Record<string, string>>(
    {},
  );
  const [undoAction, setUndoAction] = useState<
    import("./tabActions").UndoAction | null
  >(null);
  const [focusHistory, setFocusHistory] = useState<FocusRecord[]>([]);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    void Promise.all([getConfig().then(updateConfig), getTabs().then(setTabs)])
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
    const sub = liveQuery(async () => ({
      tabMeta: await db.tabMeta.toArray(),
      workspaces: await db.workspaces.toArray(),
      sessions: await db.sessions.orderBy("createdAt").reverse().toArray(),
      notes: await db.notes.orderBy("updatedAt").reverse().toArray(),
      activity: await db.activity.toArray(),
      focusHistory: await db.focusHistory
        .orderBy("startedAt")
        .reverse()
        .toArray(),
    })).subscribe({
      next: (data) => {
        setTabMeta(data.tabMeta);
        setWorkspaces(data.workspaces);
        setSessions(data.sessions);
        setNotes(data.notes);
        setActivity(data.activity);
        setFocusHistory(data.focusHistory);
      },
      error: (e) => setError(String(e)),
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    let tabTimer: ReturnType<typeof setTimeout> | undefined;
    const loadTabs = () => {
      void getTabs()
        .then(setTabs)
        .catch((e) => setError(String(e)));
    };
    const refreshTabs = () => {
      clearTimeout(tabTimer);
      tabTimer = setTimeout(loadTabs, 60);
    };
    const refreshStorage = () => {
      const revision = configRevision.current;
      void getConfig().then((value) => {
        if (!pendingConfig.current && revision === configRevision.current)
          updateConfig(value);
      });
      if (installed)
        void chrome.storage.local
          .get("focus")
          .then((data) => setFocus((data.focus as FocusState) ?? null));
    };
    const refreshSession = () => {
      if (installed)
        void chrome.storage.session
          .get(["tabAssignments", "bulkUndo"])
          .then((data) => {
            setTabAssignments(
              (data.tabAssignments ?? {}) as Record<string, string>,
            );
            setUndoAction(
              (data.bulkUndo ?? null) as
                | import("./tabActions").UndoAction
                | null,
            );
          })
          .catch((e) => setError(String(e)));
    };
    refreshStorage();
    refreshSession();
    if (installed) {
      void chrome.windows
        .getCurrent()
        .then((win) => setCurrentWindowId(win.id ?? null))
        .catch(() => {});
      chrome.tabs.onCreated.addListener(refreshTabs);
      chrome.tabs.onRemoved.addListener(refreshTabs);
      chrome.tabs.onUpdated.addListener(refreshTabs);
      chrome.tabs.onActivated.addListener(refreshTabs);
      chrome.storage.onChanged.addListener(refreshStorage);
      chrome.storage.onChanged.addListener(refreshSession);
      chrome.tabs.onMoved.addListener(refreshTabs);
      chrome.tabs.onAttached.addListener(refreshTabs);
      chrome.tabs.onDetached.addListener(refreshTabs);
    }
    return () => {
      sub.unsubscribe();
      clearInterval(timer);
      clearTimeout(tabTimer);
      if (installed) {
        chrome.tabs.onCreated.removeListener(refreshTabs);
        chrome.tabs.onRemoved.removeListener(refreshTabs);
        chrome.tabs.onUpdated.removeListener(refreshTabs);
        chrome.tabs.onActivated.removeListener(refreshTabs);
        chrome.storage.onChanged.removeListener(refreshStorage);
        chrome.storage.onChanged.removeListener(refreshSession);
        chrome.tabs.onMoved.removeListener(refreshTabs);
        chrome.tabs.onAttached.removeListener(refreshTabs);
        chrome.tabs.onDetached.removeListener(refreshTabs);
      }
    };
  }, []);
  async function patchConfig(patch: Partial<Config>) {
    const revision = ++configRevision.current;
    pendingConfig.current++;
    updateConfig((current) => ({ ...current, ...patch }));
    try {
      await patchStoredConfig(patch);
    } finally {
      pendingConfig.current--;
      if (!pendingConfig.current) {
        const saved = await getConfig();
        if (!pendingConfig.current && revision === configRevision.current)
          updateConfig(saved);
      }
    }
  }

  return {
    tabs,
    currentWindowId,
    tabMeta,
    tabAssignments,
    undoAction,
    config,
    patchConfig,
    workspaces,
    sessions,
    notes,
    activity,
    focusHistory,
    focus,
    now,
    ready,
    error,
    setError,
  };
}
export type Aether = ReturnType<typeof useAether>;
