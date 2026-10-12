import { describe, expect, it } from "vitest";
import {
  LocalSearchIndex,
  parseSearch,
  validCommandHistory,
  type SearchDocument,
} from "../../src/lib/searchIndex";
const documents: SearchDocument[] = [
  {
    id: "command:settings",
    kind: "command",
    title: "Appearance & settings",
    detail: "Make Aether yours",
  },
  {
    id: "tab:1",
    kind: "tab",
    title: "TypeScript documentation",
    detail: "https://typescriptlang.org",
    extra: "Favorite Development",
  },
  {
    id: "note:1",
    kind: "note",
    title: "TypeScript plan",
    detail: "Read the documentation",
  },
];
describe("incremental local command index", () => {
  it("only normalizes changed documents and prunes removed records", () => {
    const index = new LocalSearchIndex();
    expect(index.sync(documents)).toBe(3);
    expect(index.sync(documents.map((row) => ({ ...row })))).toBe(0);
    expect(index.sync([{ ...documents[0]!, title: "Preferences" }])).toBe(1);
    expect(index.search("TypeScript")).toEqual([]);
    expect(index.search("Preferences")[0]?.id).toBe("command:settings");
  });
  it("supports type prefixes and command navigation search", () => {
    const index = new LocalSearchIndex();
    index.sync(documents);
    expect(index.search("Appearance")[0]?.id).toBe("command:settings");
    expect(index.search("t: typescript").map((row) => row.id)).toEqual([
      "tab:1",
    ]);
    expect(index.search("n: documentation").map((row) => row.id)).toEqual([
      "note:1",
    ]);
    expect(index.search("> Appearance").map((row) => row.id)).toEqual([
      "command:settings",
    ]);
    expect(parseSearch("b: café")).toEqual({ kind: "bookmark", text: "cafe" });
  });
  it("ranks exact and word matches above subsequences deterministically", () => {
    const index = new LocalSearchIndex();
    index.sync([
      { id: "a", kind: "tab", title: "React", detail: "" },
      {
        id: "b",
        kind: "tab",
        title: "Read each archived collection today",
        detail: "",
      },
      { id: "c", kind: "tab", title: "React reference", detail: "" },
    ]);
    expect(index.search("react").map((row) => row.id)).toEqual(["a", "c", "b"]);
    expect(index.search("rct")).toHaveLength(3);
  });
  it("searches labels and favors actual recent choices for empty input", () => {
    const index = new LocalSearchIndex();
    index.sync(documents);
    expect(index.search("favorite development")[0]?.id).toBe("tab:1");
    expect(index.search("", ["note:1"])[0]?.id).toBe("note:1");
  });
  it("validates and bounds recent selections without accepting arbitrary objects", () => {
    expect(
      validCommandHistory(["tab:1", null, "tab:1", 4, {}, "", "x".repeat(241)]),
    ).toEqual(["tab:1"]);
    expect(
      validCommandHistory(Array.from({ length: 40 }, (_, i) => `tab:${i}`)),
    ).toHaveLength(20);
    expect(validCommandHistory({ ids: ["tab:1"] })).toEqual([]);
  });
});
