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
  id: z.string(),
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  tabs: z.array(savedTabSchema).max(2000),
  createdAt: z.number(),
});
export const sessionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  tabs: z.array(savedTabSchema).max(2000),
  createdAt: z.number(),
});
export const noteSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  body: z.string().max(100000),
  updatedAt: z.number(),
  done: z.boolean(),
});
export const configSchema = z.object({
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
export const backupSchema = z.object({
  version: z.literal(1),
  config: configSchema,
  workspaces: z.array(workspaceSchema).max(500),
  sessions: z.array(sessionSchema).max(500),
  notes: z.array(noteSchema).max(5000),
});
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
