import { useState } from "react";
import { Play, Square } from "lucide-react";
import { Field } from "../components/ui";
import { installed } from "../lib/browser";
import { remaining } from "../lib/model";
import type { FeatureProps } from "./types";
export function FocusTimer({
  a,
  run,
  mini = false,
}: FeatureProps & { mini?: boolean }) {
  const [goal, setGoal] = useState("");
  const [starting, setStarting] = useState(false);
  const seconds = remaining(a.focus, a.now);
  const full = a.focus
    ? (a.focus.endsAt - a.focus.startedAt) / 1000
    : a.config.focusMinutes * 60;
  const progress = a.focus ? Math.max(0, Math.min(1, 1 - seconds / full)) : 0;
  const display = a.focus ? seconds : a.config.focusMinutes * 60;
  return (
    <div className={`focus-timer ${mini ? "mini" : ""}`}>
      <div className="timer-face">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="timer-track" cx="60" cy="60" r="54" />
          <circle
            className="timer-progress"
            cx="60"
            cy="60"
            r="54"
            pathLength="1"
            strokeDasharray={`${progress} 1`}
          />
        </svg>
        <span>
          {String(Math.floor(display / 60)).padStart(2, "0")}
          <span>:</span>
          {String(display % 60).padStart(2, "0")}
        </span>
      </div>
      {!mini && (
        <>
          <h2>
            {a.focus ? "One thing at a time." : "Make room for deep work."}
          </h2>
          <p className="muted">
            {a.focus
              ? a.focus.goal || "Your focus session is running."
              : "Set an intention. Let everything else wait."}
          </p>
          {!a.focus && (
            <>
              <div
                className="focus-presets"
                role="group"
                aria-label="Focus duration presets"
              >
                {[15, 25, 45, 60].map((minutes) => (
                  <button
                    key={minutes}
                    aria-label={`${minutes} minutes`}
                    disabled={starting}
                    aria-pressed={a.config.focusMinutes === minutes}
                    onClick={() =>
                      run(() => a.patchConfig({ focusMinutes: minutes }))
                    }
                  >
                    {minutes}
                    <small>min</small>
                  </button>
                ))}
              </div>
              <Field label="What are you working on?">
                <input
                  maxLength={160}
                  placeholder="e.g. Finish the first draft"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </Field>
            </>
          )}
        </>
      )}
      <button
        disabled={!installed || starting}
        className={a.focus ? "secondary" : "primary"}
        onClick={() =>
          run(
            async () => {
              setStarting(true);
              try {
                if (a.focus) {
                  await chrome.storage.local.remove("focus");
                  await chrome.alarms.clear("focus");
                } else {
                  const startedAt = Date.now();
                  const endsAt = startedAt + a.config.focusMinutes * 60000;
                  await chrome.storage.local.set({
                    focus: { startedAt, endsAt, goal },
                  });
                  await chrome.alarms.create("focus", { when: endsAt });
                  await chrome.action.setBadgeText({ text: "" });
                }
              } finally {
                setStarting(false);
              }
            },
            a.focus ? "Focus session stopped" : "Focus session started",
          )
        }
      >
        {a.focus ? <Square size={14} /> : <Play size={14} />}{" "}
        {a.focus ? "Stop session" : "Begin focus"}
      </button>
    </div>
  );
}
