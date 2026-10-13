import { describe, expect, it } from "vitest";
import {
  activitySummary,
  dayRange,
  focusSummary,
} from "../../src/lib/insights";
import { localDay, configSchema } from "../../src/lib/model";
const now = new Date(2026, 9, 13, 14).getTime();
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).getTime();
describe("local insights", () => {
  it("includes today, zero fills missing days, and compares nonoverlapping periods", () => {
    const summary = activitySummary(
      [
        { id: "1", day: "2026-10-13", domain: "a.test", seconds: 600 },
        { id: "2", day: "2026-10-12", domain: "a.test", seconds: 300 },
        { id: "3", day: "2026-10-07", domain: "b.test", seconds: 300 },
        { id: "4", day: "2026-10-06", domain: "a.test", seconds: 600 },
        { id: "5", day: "2026-09-20", domain: "outside.test", seconds: 9999 },
        { id: "6", day: "2026-10-14", domain: "future.test", seconds: 9999 },
      ],
      now,
      7,
    );
    expect(summary.days).toHaveLength(7);
    expect(summary.days[0]!.day).toBe("2026-10-07");
    expect(summary.days[6]!.seconds).toBe(600);
    expect(summary.days[1]!.seconds).toBe(0);
    expect(summary.total).toBe(1200);
    expect(summary.previous).toBe(600);
    expect(summary.change).toBe(100);
    expect(summary.domains).toEqual([
      ["a.test", 900],
      ["b.test", 300],
    ]);
    expect(summary.activeDays).toBe(3);
  });
  it("does not invent percent changes with no baseline", () => {
    expect(activitySummary([], now, 30)).toMatchObject({
      total: 0,
      previous: 0,
      change: null,
      activeDays: 0,
    });
    expect(dayRange(now, 90).at(-1)!.day).toBe(localDay(now));
    expect(new Set(dayRange(now, 91).map((row) => row.day)).size).toBe(91);
  });
  it("counts consecutive completed days, including yesterday before today's first session", () => {
    const history = [12, 11, 9].map((day) => ({
      id: String(day),
      startedAt: at(day),
      duration: 1500,
      goal: "Work",
    }));
    expect(focusSummary(history, now)).toMatchObject({ today: 0, streak: 2 });
    history.push({
      id: "13",
      startedAt: at(13),
      duration: 2700,
      goal: "Write",
    });
    expect(focusSummary(history, now)).toMatchObject({
      today: 2700,
      streak: 3,
    });
    expect(focusSummary(history, at(15))).toMatchObject({
      today: 0,
      streak: 0,
    });
  });
  it("attributes an overnight session to its completion day", () => {
    const summary = focusSummary(
      [
        {
          id: "overnight",
          startedAt: new Date(2026, 9, 12, 23, 50).getTime(),
          duration: 1500,
          goal: "Read",
        },
      ],
      now,
    );
    expect(summary.today).toBe(1500);
    expect(summary.streak).toBe(1);
  });
  it("migrates old preferences without changing them and validates new controls", () => {
    expect(
      configSchema.parse({ theme: "oled", focusMinutes: 45 }),
    ).toMatchObject({
      theme: "oled",
      focusMinutes: 45,
      reducedMotion: false,
      dailyFocusGoal: 120,
    });
    expect(configSchema.safeParse({ dailyFocusGoal: 0 }).success).toBe(false);
    expect(configSchema.safeParse({ reducedMotion: "yes" }).success).toBe(
      false,
    );
  });
});
