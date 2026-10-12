import { describe, expect, it } from "vitest";
import {
  backupSchema,
  configSchema,
  defaults,
  safeUrl,
  serializeTabs,
  duplicateGroups,
  compareVersions,
  remaining,
} from "../../src/lib/model";
import { activitySlices } from "../../src/lib/activity";
function tab(extra: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return {
    id: 1,
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
    ...extra,
  };
}
describe("safe browser data", () => {
  it("rejects executable, file, and browser URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "chrome://settings",
      "file:///secret",
      "bad-url",
    ])
      expect(safeUrl(url)).toBeNull();
    expect(safeUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });
  it("excludes incognito and internal pages from snapshots", () => {
    const tabs = [
      tab({ url: "https://a.test", pinned: true }),
      tab({ url: "https://b.test", windowId: 4 }),
      tab({ url: "https://secret.test", incognito: true }),
      tab({ url: "chrome://settings" }),
    ];
    expect(serializeTabs(tabs)).toEqual([
      { url: "https://a.test", title: "a.test", pinned: true, window: 0 },
      { url: "https://b.test", title: "b.test", pinned: false, window: 1 },
    ]);
  });
  it("finds duplicate URLs while retaining meaningful query differences", () => {
    const groups = duplicateGroups([
      tab({ url: "https://a.test/page#one" }),
      tab({ id: 2, url: "https://a.test/page#two" }),
      tab({ id: 3, url: "https://a.test/page?q=1" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });
  it("rejects unsafe imports and unsupported backup versions", () => {
    const valid = {
      version: 1,
      config: {},
      workspaces: [],
      sessions: [],
      notes: [],
    };
    expect(backupSchema.parse(valid).config.tracking).toBe(false);
    expect(backupSchema.safeParse({ ...valid, version: 2 }).success).toBe(
      false,
    );
    expect(
      backupSchema.safeParse({
        ...valid,
        sessions: [
          {
            id: "x",
            name: "Injected",
            createdAt: 1,
            tabs: [
              {
                url: "javascript:alert(1)",
                title: "x",
                pinned: false,
                window: 0,
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("validates theme, glass strength, focus duration, and accent", () => {
    expect(configSchema.safeParse({ glass: 120 }).success).toBe(false);
    expect(configSchema.safeParse({ accent: "url(foo)" }).success).toBe(false);
    expect(configSchema.safeParse({ focusMinutes: 0 }).success).toBe(false);
    expect(defaults.tracking).toBe(false);
  });
});
describe("durable clocks and release comparison", () => {
  it("uses timestamps for focus and clamps elapsed sessions to zero", () => {
    const focus = { startedAt: 1000, endsAt: 61000, goal: "Test" };
    expect(remaining(focus, 31000)).toBe(30);
    expect(remaining(focus, 999999)).toBe(0);
    expect(remaining(null, 0)).toBe(0);
  });
  it("compares numeric release parts rather than strings", () => {
    expect(compareVersions("v0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.1.0", "1.0.0")).toBe(-1);
  });
  it("never counts worker suspension gaps or inactive time", () => {
    expect(activitySlices({ at: 1000, domain: "a.test" }, 92000)).toEqual([]);
    expect(activitySlices({ at: 1000, domain: null }, 61000)).toEqual([]);
    expect(
      activitySlices({ at: 1000, domain: "a.test" }, 61000)[0]?.seconds,
    ).toBe(60);
    expect(activitySlices({ at: 1000, domain: "a.test" }, 999)).toEqual([]);
  });
  it("splits observations correctly over local midnight", () => {
    const start = new Date(2026, 9, 12, 23, 59, 30).getTime();
    const rows = activitySlices({ at: start, domain: "a.test" }, start + 60000);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.seconds)).toEqual([30, 30]);
    expect(rows[0]?.day).not.toBe(rows[1]?.day);
  });
});

import { accentColors, contrast } from "../../src/lib/colors";
it("keeps custom accent text readable in light and dark materials", () => {
  for (const color of [
    "#007aff",
    "#ffffff",
    "#000000",
    "#00ff00",
    "#ffff00",
    "#af52de",
  ]) {
    const variants = accentColors(color);
    expect(contrast(variants.light, "#dfe4ef")).toBeGreaterThanOrEqual(5);
    expect(contrast(variants.dark, "#343843")).toBeGreaterThanOrEqual(5);
    expect(contrast(variants.fill, "#ffffff")).toBeGreaterThanOrEqual(5);
  }
});
