import { localDay, type Activity, type FocusRecord } from "./model";

export function dayRange(now: number, count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    // Calendar arithmetic preserves local days across daylight-saving changes.
    date.setDate(date.getDate() - offset - count + 1 + i);
    return { day: localDay(date.getTime()), date };
  });
}

export function activitySummary(
  activity: Activity[],
  now: number,
  count: number,
) {
  const totals = new Map<string, number>();
  for (const row of activity)
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.seconds);
  const days = dayRange(now, count).map(({ day, date }) => ({
    day,
    label: date.toLocaleDateString(undefined, { weekday: "short" }),
    seconds: totals.get(day) ?? 0,
  }));
  const selected = new Set(days.map((row) => row.day));
  const domains = new Map<string, number>();
  for (const row of activity) {
    if (selected.has(row.day))
      domains.set(row.domain, (domains.get(row.domain) ?? 0) + row.seconds);
  }
  const total = days.reduce((sum, row) => sum + row.seconds, 0);
  const previous = dayRange(now, count, count).reduce(
    (sum, row) => sum + (totals.get(row.day) ?? 0),
    0,
  );
  return {
    days,
    total,
    previous,
    change:
      previous > 0 ? Math.round(((total - previous) / previous) * 100) : null,
    average: total / count,
    activeDays: days.filter((row) => row.seconds > 0).length,
    domains: [...domains].sort((a, b) => b[1] - a[1]),
  };
}

export function focusSummary(history: FocusRecord[], now: number) {
  const today = localDay(now);
  const daily = new Map<string, number>();
  for (const row of history) {
    // Attribute completed sessions to their completion day, including overnight sessions.
    const day = localDay(row.startedAt + row.duration * 1000);
    daily.set(day, (daily.get(day) ?? 0) + row.duration);
  }
  let streak = 0;
  const date = new Date(now);
  if (!daily.has(today)) date.setDate(date.getDate() - 1);
  while (daily.has(localDay(date.getTime()))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return {
    today: daily.get(today) ?? 0,
    streak,
    week: dayRange(now, 7).map(({ day, date }) => ({
      day,
      label: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      seconds: daily.get(day) ?? 0,
    })),
  };
}
