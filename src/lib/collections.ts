import type { SavedTab } from "./model";

/** Compare multisets so duplicate tabs and saved window/pinned metadata remain meaningful. */
export function compareSnapshots(before: SavedTab[], after: SavedTab[]) {
  const key = (tab: SavedTab) =>
    JSON.stringify([tab.url, tab.pinned, tab.window]);
  const remaining = [...after];
  const removed: SavedTab[] = [];
  let unchanged = 0;
  for (const tab of before) {
    const index = remaining.findIndex(
      (candidate) => key(candidate) === key(tab),
    );
    if (index === -1) removed.push(tab);
    else {
      remaining.splice(index, 1);
      unchanged++;
    }
  }
  return { removed, added: remaining, unchanged };
}
