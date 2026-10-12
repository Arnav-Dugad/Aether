import Dexie, { type Table } from "dexie";
import type {
  Workspace,
  Session,
  Note,
  Activity,
  FocusRecord,
  TabMeta,
} from "./model";
export class AetherDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  sessions!: Table<Session, string>;
  notes!: Table<Note, string>;
  activity!: Table<Activity, string>;
  tabMeta!: Table<TabMeta, string>;
  focusHistory!: Table<FocusRecord, string>;
  constructor(name = "aether") {
    super(name);
    this.version(1).stores({
      workspaces: "id,createdAt",
      sessions: "id,createdAt",
      notes: "id,updatedAt",
      activity: "id,day,domain",
      focusHistory: "id,startedAt",
    });
    this.version(2)
      .stores({ tabMeta: "url,favorite,protected,updatedAt" })
      .upgrade(async (tx) => {
        await tx
          .table("workspaces")
          .toCollection()
          .modify((row) => {
            row.description ??= "";
            row.archived ??= false;
            row.template ??= false;
          });
        await tx
          .table("notes")
          .toCollection()
          .modify((row) => {
            row.workspaceId ??= null;
            row.url ??= null;
            row.priority ??= "normal";
            row.dueDate ??= null;
          });
      });
  }
}
export const db = new AetherDatabase();
