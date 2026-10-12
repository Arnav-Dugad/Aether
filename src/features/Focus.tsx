import { CircleCheck, Coffee } from "lucide-react";
import { Panel, Empty } from "../components/ui";
import { duration } from "../lib/model";
import { FocusTimer } from "./FocusTimer";
import type { FeatureProps } from "./types";
export function Focus(props: FeatureProps) {
  return (
    <div className="two-column">
      <Panel className="focus-panel">
        <FocusTimer {...props} />
        <p className="caption">
          The timer uses saved timestamps and survives page closure. This
          version does not block websites.
        </p>
      </Panel>
      <Panel title="Time well spent" label="COMPLETED SESSIONS">
        {props.a.focusHistory.length ? (
          props.a.focusHistory.slice(0, 20).map((row) => (
            <div className="setting-row" key={row.id}>
              <CircleCheck size={20} />
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
  );
}
