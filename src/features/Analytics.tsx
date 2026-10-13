import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Shield,
  TrendingUp,
  Target,
  Flame,
} from "lucide-react";
import { Empty, Panel } from "../components/ui";
import { download } from "../lib/browser";
import { duration, localDay } from "../lib/model";
import { activitySummary, dayRange, focusSummary } from "../lib/insights";
import type { FeatureProps } from "./types";

export function Analytics({ a, run }: FeatureProps) {
  const [range, setRange] = useState(7);
  const calendarNow = new Date(localDay(a.now) + "T12:00:00").getTime();
  const summary = useMemo(
    () => activitySummary(a.activity, calendarNow, range),
    [a.activity, calendarNow, range],
  );
  const focus = useMemo(
    () => focusSummary(a.focusHistory, calendarNow),
    [a.focusHistory, calendarNow],
  );
  const max = Math.max(...summary.days.map((row) => row.seconds), 60);
  const heat = useMemo(
    () => activitySummary(a.activity, calendarNow, 91),
    [a.activity, calendarNow],
  );
  const heatMax = Math.max(60, ...heat.days.map((row) => row.seconds));
  const start = dayRange(a.now, range)[0]!.date;
  start.setHours(0, 0, 0, 0);
  const rangeFocus = a.focusHistory.filter((row) => {
    const ended = row.startedAt + row.duration * 1000;
    return ended >= start.getTime() && ended <= a.now;
  });
  const selected = new Set(summary.days.map((row) => row.day));
  const csvRows = a.activity.filter((row) => selected.has(row.day));
  return (
    <>
      <div className="toolbar insights-toolbar">
        <div
          className="segmented"
          role="group"
          aria-label="Analytics date range"
        >
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {value} days
            </button>
          ))}
        </div>
        <p className="muted">Foreground activity · local timezone</p>
        <button
          className="secondary"
          disabled={!csvRows.length}
          onClick={() =>
            download(
              `aether-activity-${range}d.csv`,
              "date,domain,seconds\n" +
                csvRows
                  .map(
                    (row) =>
                      `${row.day},"${row.domain.replaceAll('"', '""')}",${Math.round(row.seconds)}`,
                  )
                  .join("\n"),
              "text/csv",
            )
          }
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
      <div className="stats-grid insight-metrics">
        <Panel>
          <span className="eyebrow">
            <BarChart3 size={14} /> ACTIVE TIME
          </span>
          <strong className="metric">{duration(summary.total)}</strong>
          <span className="caption">
            Across {summary.domains.length} websites · {range} days
          </span>
        </Panel>
        <Panel>
          <span className="eyebrow">
            <TrendingUp size={14} /> DAILY AVERAGE
          </span>
          <strong className="metric">{duration(summary.average)}</strong>
          <span className="caption">
            {summary.change === null
              ? "No comparison data in the previous period"
              : `${summary.change > 0 ? "+" : ""}${summary.change}% vs previous ${range} days (includes today)`}
          </span>
        </Panel>
        <Panel>
          <span className="eyebrow">
            <Target size={14} /> COMPLETED FOCUS
          </span>
          <strong className="metric">
            {duration(rangeFocus.reduce((sum, row) => sum + row.duration, 0))}
          </strong>
          <span className="caption">
            {rangeFocus.length} sessions · {focus.streak}-day current streak
          </span>
        </Panel>
      </div>
      <div className="two-column">
        <Panel
          title="A rhythm of your own"
          label={`BROWSING ACTIVITY / ${range} DAYS`}
        >
          {summary.total > 0 ? (
            <div
              className={`bar-chart range-${range}`}
              role="img"
              aria-label={summary.days
                .map((row) => `${row.day}: ${duration(row.seconds)}`)
                .join(", ")}
            >
              {summary.days.map((row, index) => (
                <div className="chart-column" key={row.day}>
                  <span>{range === 7 ? duration(row.seconds) : ""}</span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      title={`${row.day}: ${duration(row.seconds)}`}
                      style={{ height: `${(row.seconds / max) * 100}%` }}
                    />
                  </div>
                  <small>
                    {range === 7
                      ? row.label
                      : index === 0 ||
                          index === range - 1 ||
                          index % Math.ceil(range / 4) === 0
                        ? row.day.slice(5)
                        : ""}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<BarChart3 />}
              title="Your story starts with real data"
            >
              {a.config.tracking
                ? "Browse regular web pages to see your activity in this period."
                : "Enable local tracking to start building your activity picture."}
            </Empty>
          )}
        </Panel>
        <Panel title="Where your time goes" label="WEBSITE DISTRIBUTION">
          {summary.domains.length ? (
            summary.domains.slice(0, 8).map(([host, seconds], index) => (
              <div className="domain-usage" key={host}>
                <div>
                  <strong>
                    <span className="domain-rank">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {host}
                  </strong>
                  <span>
                    {duration(seconds)} ·{" "}
                    {Math.round((seconds / summary.total) * 100)}%
                  </span>
                </div>
                <progress
                  value={seconds}
                  max={summary.total}
                  aria-label={`${host}: ${duration(seconds)}`}
                />
              </div>
            ))
          ) : (
            <Empty title="A little perspective, in time">
              Website shares appear when there is recorded activity in this
              period.
            </Empty>
          )}
        </Panel>
      </div>
      <Panel
        title="Small moments, a bigger picture"
        label="91-DAY ACTIVITY MAP"
        className="heatmap-panel"
        action={<span className="caption">{heat.activeDays} active days</span>}
      >
        <div
          className="heatmap"
          role="img"
          aria-label={`Daily recorded activity: ${heat.days.map((row) => `${row.day}: ${duration(row.seconds)}`).join(", ")}`}
        >
          {heat.days.map((row) => (
            <div
              key={row.day}
              className="heat-cell"
              title={`${row.day}: ${duration(row.seconds)}`}
              data-level={
                row.seconds === 0
                  ? 0
                  : Math.max(1, Math.ceil((row.seconds / heatMax) * 4))
              }
            />
          ))}
        </div>
        <div className="heatmap-legend">
          <span>
            {heat.days[0]!.day} — {heat.days[90]!.day} · columns read top to
            bottom
          </span>
          <span>
            Less{" "}
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} className="heat-cell" data-level={level} />
            ))}{" "}
            More
          </span>
        </div>
      </Panel>
      <div className="insight-footnote">
        <Flame size={16} />
        <p>
          {focus.streak
            ? `You've completed focus sessions on ${focus.streak} consecutive days. Keep making space for meaningful work.`
            : "Your focus streak starts with one completed session. Focus works with activity tracking turned off."}
        </p>
      </div>
      <p className="caption">
        Measurement is approximate. Minute alarms, focus changes, and a
        60-second idle threshold bound observed intervals. Gaps over 90 seconds
        are discarded. No past durations are inferred from history. Comparisons
        include the current partial day.
      </p>
    </>
  );
}
