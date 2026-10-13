import { z } from "zod";
export const httpUrl = z
  .string()
  .max(8192)
  .refine((value) => {
    try {
      return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use an http or https URL");
export const savedTabSchema = z.object({
  url: httpUrl,
  title: z.string().max(1024),
  pinned: z.boolean(),
  window: z.number().int().nonnegative(),
});
export const workspaceSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  tabs: z.array(savedTabSchema).max(2000),
  createdAt: z.number(),
  description: z.string().max(2000).default(""),
  archived: z.boolean().default(false),
  template: z.boolean().default(false),
});
export const sessionSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(80),
  tabs: z.array(savedTabSchema).max(2000),
  createdAt: z.number(),
});
export const noteSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().max(120),
  body: z.string().max(100000),
  updatedAt: z.number(),
  done: z.boolean(),
  workspaceId: z.string().max(160).nullable().default(null),
  url: httpUrl.nullable().default(null),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value + "T00:00:00Z");
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Use a valid calendar date")
    .nullable()
    .default(null),
});
export const configSchema = z.object({
  activeWorkspaceId: z.string().max(160).nullable().default(null),
  tabView: z.enum(["list", "cards", "domains", "windows"]).default("list"),
  tabSort: z.enum(["browser", "title", "domain", "recent"]).default("browser"),
  surfaceViews: z
    .partialRecord(
      z.enum(["app", "newtab", "popup", "sidepanel"]),
      z.enum([
        "dashboard",
        "tabs",
        "workspaces",
        "sessions",
        "notes",
        "settings",
        "privacy",
        "analytics",
        "focus",
        "bookmarks",
        "history",
        "updates",
        "performance",
        "suggestions",
      ]),
    )
    .default({
      app: "dashboard",
      newtab: "dashboard",
      popup: "tabs",
      sidepanel: "tabs",
    }),
  theme: z
    .enum(["system", "light", "obsidian", "graphite", "oled"])
    .default("light"),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#007aff"),
  glass: z.number().min(0).max(100).default(70),
  reducedTransparency: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  compact: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  dailyFocusGoal: z.number().int().min(15).max(480).default(120),
  name: z.string().max(50).default(""),
  tracking: z.boolean().default(false),
  autoSnapshot: z.boolean().default(false),
  focusMinutes: z.number().int().min(1).max(240).default(25),
  onboardingDone: z.boolean().default(false),
  widgets: z
    .array(
      z.enum(["tabs", "workspaces", "focus", "notes", "activity", "sessions"]),
    )
    .max(6)
    .refine(
      (values) => new Set(values).size === values.length,
      "Widgets must be unique",
    )
    .default(["tabs", "workspaces", "focus", "notes", "activity", "sessions"]),
});
export const tabMetaSchema = z.object({
  url: httpUrl,
  label: z.string().max(80).default(""),
  favorite: z.boolean().default(false),
  protected: z.boolean().default(false),
  updatedAt: z.number(),
});
export const backupSchema = z.object({
  version: z.literal(1),
  config: configSchema,
  workspaces: z.array(workspaceSchema).max(500),
  sessions: z.array(sessionSchema).max(500),
  notes: z.array(noteSchema).max(5000),
  tabMeta: z.array(tabMetaSchema).max(20000).default([]),
});
export type TabMeta = z.infer<typeof tabMetaSchema>;
export type Config = z.infer<typeof configSchema>;
export type SavedTab = z.infer<typeof savedTabSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Note = z.infer<typeof noteSchema>;
export interface Activity {
  id: string;
  day: string;
  domain: string;
  seconds: number;
}
export interface FocusRecord {
  id: string;
  startedAt: number;
  duration: number;
  goal: string;
}
export interface FocusState {
  startedAt: number;
  endsAt: number;
  goal: string;
}
export const defaults = configSchema.parse({});
export function mergeConfig(current: Config, patch: unknown): Config {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new Error("Invalid preference update.");
  const values = patch as Record<string, unknown>;
  if (Object.keys(values).some((key) => !Object.hasOwn(defaults, key)))
    throw new Error("Unknown preference.");
  if (
    "surfaceViews" in values &&
    (!values.surfaceViews ||
      typeof values.surfaceViews !== "object" ||
      Array.isArray(values.surfaceViews))
  )
    throw new Error("Invalid view preferences.");
  return configSchema.parse({
    ...current,
    ...values,
    surfaceViews: {
      ...current.surfaceViews,
      ...((values.surfaceViews ?? {}) as object),
    },
  });
}
export function safeUrl(value: string): string | null {
  const result = httpUrl.safeParse(value);
  return result.success ? result.data : null;
}
export function domain(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Browser page";
  }
}
export function localDay(at = Date.now()): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function duration(seconds: number): string {
  return seconds >= 3600
    ? `${(seconds / 3600).toFixed(1)}h`
    : `${Math.floor(seconds / 60)}m`;
}
export function remaining(focus: FocusState | null, now: number): number {
  return focus ? Math.max(0, Math.ceil((focus.endsAt - now) / 1000)) : 0;
}
export function duplicateGroups(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[][] {
  const groups = new Map<string, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    if (!tab.url || !safeUrl(tab.url)) continue;
    const url = new URL(tab.url);
    url.hash = "";
    const key = url.href;
    groups.set(key, [...(groups.get(key) ?? []), tab]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
export function serializeTabs(tabs: chrome.tabs.Tab[]): SavedTab[] {
  const windows = [...new Set(tabs.map((t) => t.windowId))];
  return tabs
    .filter((t) => !t.incognito && t.url && safeUrl(t.url))
    .map((t) => ({
      url: t.url!,
      title: t.title ?? domain(t.url!),
      pinned: t.pinned,
      window: windows.indexOf(t.windowId),
    }));
}
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => Number(n));
  const x = parse(a),
    y = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}
