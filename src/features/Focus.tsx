import { useMemo, useState } from "react";
import { CircleCheck, Coffee, Expand, Flame, Target } from "lucide-react";
import { Panel, Empty, Modal } from "../components/ui";
import { duration, localDay } from "../lib/model";
import { focusSummary } from "../lib/insights";
import { FocusTimer } from "./FocusTimer";
import type { FeatureProps } from "./types";

export function Focus(props: FeatureProps) {
  const [immersive, setImmersive] = useState(false);
  const calendarNow = new Date(localDay(props.a.now) + "T12:00:00").getTime();
  const summary = useMemo(
    () => focusSummary(props.a.focusHistory, calendarNow),
    [props.a.focusHistory, calendarNow],
  );
  const goal = props.a.config.dailyFocusGoal * 60;
  return (
    <>
      <div className="stats-grid focus-metrics">
        <Panel>
          <span className="eyebrow">
            <Target size={14} /> TODAY'S FOCUS
          </span>
          <strong className="metric">{duration(summary.today)}</strong>
          <span className="caption">
            of your {props.a.config.dailyFocusGoal}-minute daily goal
          </span>
          <progress
            aria-label="Daily focus goal progress"
            value={Math.min(summary.today, goal)}
            max={goal}
          />
        </Panel>
        <Panel>
          <span className="eyebrow">
            <Flame size={14} /> YOUR MOMENTUM
          </span>
          <strong className="metric">
            {summary.streak}
            <small> days</small>
          </strong>
          <span className="caption">Current streak · today or yesterday</span>
        </Panel>
        <Panel>
          <span className="eyebrow">THIS WEEK</span>
          <div className="focus-week">
            {summary.week.map((row) => (
              <div key={row.day} title={`${row.day}: ${duration(row.seconds)}`}>
                <span className={row.seconds ? "has-focus" : ""}>
                  {row.seconds ? <CircleCheck size={18} /> : <span />}
                </span>
                <small>{row.label}</small>
              </div>
            ))}
          </div>
          <span className="caption">Every completed session counts.</span>
        </Panel>
      </div>
      <div className="two-column">
        <Panel className="focus-panel">
          <div className="focus-topline">
            <span className="eyebrow">A MOMENT, JUST FOR YOU</span>
            <button className="text-button" onClick={() => setImmersive(true)}>
              <Expand size={15} />
              Immersive view
            </button>
          </div>
          <FocusTimer {...props} />
          <p className="caption">
            Your timer survives page closure. Stopping early does not count as a
            completed session.
          </p>
        </Panel>
        <Panel title="Time well spent" label="COMPLETED SESSIONS">
          {props.a.focusHistory.length ? (
            props.a.focusHistory.slice(0, 20).map((row) => (
              <div className="setting-row focus-history-row" key={row.id}>
                <span className="launch-icon">
                  <CircleCheck size={20} />
                </span>
                <span>
                  <strong>{row.goal || "Focus session"}</strong>
                  <small>{new Date(row.startedAt).toLocaleString()}</small>
                </span>
                <span>{duration(row.duration)}</span>
              </div>
            ))
          ) : (
            <Empty icon={<Coffee />} title="A fresh start">
              Completed sessions appear here after their timer ends.
            </Empty>
          )}
        </Panel>
      </div>
      {immersive && (
        <Modal title="Room to focus" onClose={() => setImmersive(false)}>
          <div className="immersive-focus">
            <div className="focus-halo" aria-hidden="true" />
            <FocusTimer {...props} />
            <p className="caption">
              Take a breath. One thing at a time. Esc to return.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
