import { localDay } from "./model";
export interface ActiveState {
  at: number;
  domain: string | null;
}
// Never infer unobserved time after a suspended worker or a browser restart.
export function activitySlices(
  previous: ActiveState | null,
  now: number,
): { day: string; domain: string; seconds: number }[] {
  if (!previous?.domain || now <= previous.at || now - previous.at > 90000)
    return [];
  const slices = [];
  let at = previous.at;
  while (at < now) {
    const midnight = new Date(at);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(now, midnight.getTime());
    slices.push({
      day: localDay(at),
      domain: previous.domain,
      seconds: (end - at) / 1000,
    });
    at = end;
  }
  return slices;
}
