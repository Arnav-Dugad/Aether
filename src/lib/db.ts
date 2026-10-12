import Dexie, { type Table } from "dexie";
import type { Workspace, Session, Note, Activity, FocusRecord } from "./model";
class AetherDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  sessions!: Table<Session, string>;
  notes!: Table<Note, string>;
  activity!: Table<Activity, string>;
  focusHistory!: Table<FocusRecord, string>;
  constructor() {
    super("aether");
    this.version(1).stores({
      workspaces: "id,createdAt",
      sessions: "id,createdAt",
      notes: "id,updatedAt",
      activity: "id,day,domain",
      focusHistory: "id,startedAt",
    });
  }
}
export const db = new AetherDatabase();
