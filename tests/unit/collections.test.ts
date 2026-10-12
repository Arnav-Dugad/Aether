import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../../src/lib/collections";
import type { SavedTab } from "../../src/lib/model";
const tab = (extra: Partial<SavedTab> = {}): SavedTab => ({
  url: "https://example.com/",
  title: "Example",
  pinned: false,
  window: 0,
  ...extra,
});
describe("session comparison", () => {
  it("preserves duplicate counts rather than collapsing URLs", () => {
    expect(compareSnapshots([tab(), tab()], [tab()])).toEqual({
      unchanged: 1,
      added: [],
      removed: [tab()],
    });
  });
  it("reports pin and window changes even when URLs match", () => {
    const before = [tab(), tab({ url: "https://example.org/" })];
    const after = [
      tab({ pinned: true }),
      tab({ url: "https://example.org/", window: 1 }),
    ];
    expect(compareSnapshots(before, after)).toEqual({
      unchanged: 0,
      removed: before,
      added: after,
    });
  });
  it("ignores title-only changes and preserves exact URL fragments", () => {
    expect(
      compareSnapshots([tab()], [tab({ title: "Updated title" })]).unchanged,
    ).toBe(1);
    expect(
      compareSnapshots([tab()], [tab({ url: "https://example.com/#section" })])
        .unchanged,
    ).toBe(0);
  });
});
