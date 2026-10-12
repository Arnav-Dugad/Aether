import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "./db";
import { getTabs, getConfig, installed, setConfig } from "./browser";
import {
  defaults,
  type Config,
  type Workspace,
  type Session,
  type Note,
  type Activity,
  type FocusState,
  type FocusRecord,
} from "./model";
export function useAether() {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [config, updateConfig] = useState(defaults);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
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
        setWorkspaces(data.workspaces);
        setSessions(data.sessions);
        setNotes(data.notes);
        setActivity(data.activity);
        setFocusHistory(data.focusHistory);
      },
      error: (e) => setError(String(e)),
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const refreshTabs = () => {
      void getTabs()
        .then(setTabs)
        .catch((e) => setError(String(e)));
    };
    const refreshStorage = () => {
      void getConfig().then(updateConfig);
      if (installed)
        void chrome.storage.local
          .get("focus")
          .then((data) => setFocus((data.focus as FocusState) ?? null));
    };
    refreshStorage();
    if (installed) {
      chrome.tabs.onCreated.addListener(refreshTabs);
      chrome.tabs.onRemoved.addListener(refreshTabs);
      chrome.tabs.onUpdated.addListener(refreshTabs);
      chrome.tabs.onActivated.addListener(refreshTabs);
      chrome.storage.onChanged.addListener(refreshStorage);
    }
    return () => {
      sub.unsubscribe();
      clearInterval(timer);
      if (installed) {
        chrome.tabs.onCreated.removeListener(refreshTabs);
        chrome.tabs.onRemoved.removeListener(refreshTabs);
        chrome.tabs.onUpdated.removeListener(refreshTabs);
        chrome.tabs.onActivated.removeListener(refreshTabs);
        chrome.storage.onChanged.removeListener(refreshStorage);
      }
    };
  }, []);
  async function patchConfig(patch: Partial<Config>) {
    const current = await getConfig();
    const next = { ...current, ...patch };
    await setConfig(next);
    updateConfig(next);
  }
  return {
    tabs,
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
