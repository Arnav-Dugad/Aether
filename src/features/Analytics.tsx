import { BarChart3, Download, Shield } from "lucide-react";
import { Empty, Panel } from "../components/ui";
import { download } from "../lib/browser";
import { duration, localDay } from "../lib/model";
import type { FeatureProps } from "./types";
export function Analytics({ a, run }: FeatureProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(a.now);
    date.setDate(date.getDate() - 6 + i);
    const day = localDay(date.getTime());
    return {
      day,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      seconds: a.activity
        .filter((row) => row.day === day)
        .reduce((n, row) => n + row.seconds, 0),
    };
  });
  const total = days.reduce((n, row) => n + row.seconds, 0);
  const today = days[6]!.seconds;
  const max = Math.max(...days.map((d) => d.seconds), 60);
  const domains = new Map<string, number>();
  for (const row of a.activity.filter((r) => days.some((d) => d.day === r.day)))
    domains.set(row.domain, (domains.get(row.domain) ?? 0) + row.seconds);
  const sorted = [...domains].sort((x, y) => y[1] - x[1]);
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          Observed foreground browsing · last 7 days · your local timezone
        </p>
        <button
          className="secondary"
          disabled={!a.activity.length}
          onClick={() => {
            const csv =
              "date,domain,seconds\n" +
              a.activity
                .map(
                  (r) =>
                    `${r.day},"${r.domain.replaceAll('"', '""')}",${Math.round(r.seconds)}`,
                )
                .join("\n");
            download("aether-activity.csv", csv, "text/csv");
          }}
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>
      {!a.config.tracking && (
        <Panel className="consent-panel">
          <Shield size={22} />
          <div>
            <h2>Your activity is yours.</h2>
            <p>
              Aether only records website domains and foreground durations when
              you turn this on. No page content, private browsing, or uploads.
            </p>
          </div>
          <button
            className="primary"
            onClick={() =>
              run(
                () => a.patchConfig({ tracking: true }),
                "Local activity tracking enabled",
              )
            }
          >
            Enable local tracking
          </button>
        </Panel>
      )}
      <div className="stats-grid">
        <Panel>
          <span className="eyebrow">TODAY</span>
          <strong className="metric">{duration(today)}</strong>
          <span className="caption">Observed active time</span>
        </Panel>
        <Panel>
          <span className="eyebrow">THIS WEEK</span>
          <strong className="metric">{duration(total)}</strong>
          <span className="caption">Across {domains.size} websites</span>
        </Panel>
        <Panel>
          <span className="eyebrow">FOCUS SESSIONS</span>
          <strong className="metric">{a.focusHistory.length}</strong>
          <span className="caption">Completed on this device</span>
        </Panel>
      </div>
      <div className="two-column">
        <Panel title="Your week, at a glance" label="FOREGROUND ACTIVITY">
          {a.activity.length ? (
            <div
              className="bar-chart"
              role="img"
              aria-label={days
                .map((d) => `${d.label}: ${duration(d.seconds)}`)
                .join(", ")}
            >
              {days.map((d) => (
                <div className="chart-column" key={d.day}>
                  <span>{duration(d.seconds)}</span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ height: `${(d.seconds / max) * 100}%` }}
                    />
                  </div>
                  <small>{d.label}</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<BarChart3 />}
              title="Your story starts with real data"
            >
              Once tracking is enabled, spend time on regular web pages.
              Recorded activity will appear here.
            </Empty>
          )}
        </Panel>
        <Panel title="Where your time goes" label="WEBSITES">
          {sorted.length ? (
            sorted.slice(0, 8).map(([host, seconds]) => (
              <div className="domain-usage" key={host}>
                <div>
                  <strong>{host}</strong>
                  <span>{duration(seconds)}</span>
                </div>
                <progress
                  value={seconds}
                  max={sorted[0]![1]}
                  aria-label={`${host}: ${duration(seconds)}`}
                />
              </div>
            ))
          ) : (
            <Empty title="No website activity yet">
              Aether never fills charts with made-up numbers.
            </Empty>
          )}
        </Panel>
      </div>
      <p className="caption">
        Measurement is approximate. Minute alarms, focus changes, and a
        60-second idle threshold bound observed intervals. Gaps over 90 seconds
        are discarded after worker suspension. Browser history is not used to
        infer past durations.
      </p>
    </>
  );
}
