import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { AetherDatabase } from "../../src/lib/db";
it("upgrades v1 workspaces and notes without changing their saved data", async () => {
  const name = `aether-migration-${Date.now()}`;
  const legacy = new Dexie(name);
  legacy
    .version(1)
    .stores({
      workspaces: "id,createdAt",
      sessions: "id,createdAt",
      notes: "id,updatedAt",
      activity: "id,day,domain",
      focusHistory: "id,startedAt",
    });
  const workspace = {
    id: "work",
    name: "Original work",
    color: "#007aff",
    createdAt: 1,
    tabs: [
      {
        url: "https://example.test",
        title: "Original tab",
        pinned: true,
        window: 0,
      },
    ],
  };
  const note = {
    id: "note",
    title: "Original note",
    body: "Never lose this",
    updatedAt: 1,
    done: false,
  };
  await legacy.table("workspaces").put(workspace);
  await legacy.table("notes").put(note);
  legacy.close();
  const upgraded = new AetherDatabase(name);
  await upgraded.open();
  expect(await upgraded.workspaces.get("work")).toEqual({
    ...workspace,
    description: "",
    archived: false,
    template: false,
  });
  expect(await upgraded.notes.get("note")).toEqual({
    ...note,
    workspaceId: null,
    url: null,
    priority: "normal",
    dueDate: null,
  });
  await upgraded.tabMeta.put({
    url: "https://example.test/",
    label: "Label",
    favorite: true,
    protected: true,
    updatedAt: 1,
  });
  expect((await upgraded.tabMeta.get("https://example.test/"))?.protected).toBe(
    true,
  );
  await upgraded.delete();
});
