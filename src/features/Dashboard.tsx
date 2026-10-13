import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Search,
  Command,
  Layers,
  Plus,
  ArrowRight,
  Briefcase,
  Archive,
  BarChart3,
  FileText,
  Target,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Panel, Empty, LinkButton } from "../components/ui";
import { TabList } from "../components/TabList";
import { FocusTimer } from "./FocusTimer";
import { installed, permission, openUrl } from "../lib/browser";
import { duration, localDay } from "../lib/model";
import { focusSummary, activitySummary } from "../lib/insights";
import { DayPlanner } from "./DayPlanner";
import type { FeatureProps } from "./types";
export function Dashboard({
  a,
  run,
  navigate,
  command,
}: FeatureProps & { command: () => void }) {
  const [query, setQuery] = useState("");
  const hour = new Date(a.now).getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = a.activity
    .filter((row) => row.day === localDay(a.now))
    .reduce((sum, row) => sum + row.seconds, 0);
  const calendarNow = new Date(localDay(a.now) + "T12:00:00").getTime();
  const focus = useMemo(
    () => focusSummary(a.focusHistory, calendarNow),
    [a.focusHistory, calendarNow],
  );
  const week = useMemo(
    () => activitySummary(a.activity, calendarNow, 7),
    [a.activity, calendarNow],
  );
  async function search() {
    if (!query.trim()) return;
    let value = query.trim();
    if (/^https?:\/\//i.test(value)) return openUrl(value);
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) {
      value = `https://${value}`;
      return openUrl(value);
    }
    if (await permission("search"))
      await chrome.search.query({ text: value, disposition: "NEW_TAB" });
    else
      throw new Error(
        "Search permission is required to use your browser’s default search provider.",
      );
  }
  const widgets = {
    tabs: (
      <Panel
        title="Open tabs"
        label="RIGHT WHERE YOU LEFT OFF"
        action={
          <LinkButton onClick={() => navigate?.("tabs")}>View all</LinkButton>
        }
        className="widget-tabs"
      >
        <div className="widget-stat">
          <strong>{a.tabs.length}</strong>
          <span>
            tabs across {new Set(a.tabs.map((t) => t.windowId)).size} windows
          </span>
        </div>
        {a.tabs.length ? (
          <TabList tabs={a.tabs} run={run} limit={4} editable={false} />
        ) : (
          <Empty icon={<Layers />} title="Room to explore">
            Open a web page and it will appear here.
          </Empty>
        )}
      </Panel>
    ),
    workspaces: (
      <Panel
        title="Your spaces"
        label="A LITTLE MORE ORGANIZED"
        action={
          <LinkButton onClick={() => navigate?.("workspaces")}>
            View all
          </LinkButton>
        }
      >
        {a.workspaces.filter((row) => !row.archived && !row.template).length ? (
          <div className="workspace-shortcuts">
            {a.workspaces
              .filter((row) => !row.archived && !row.template)
              .slice(0, 3)
              .map((row) => (
                <button key={row.id} onClick={() => navigate?.("workspaces")}>
                  <span
                    className="collection-icon"
                    style={{ color: row.color }}
                  >
                    <Briefcase size={18} />
                  </span>
                  <span>
                    <strong>{row.name}</strong>
                    <small>{row.tabs.length} tabs</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </div>
        ) : (
          <Empty
            icon={<Briefcase />}
            title="A space for your next idea"
            action={
              <button
                className="text-button"
                onClick={() => navigate?.("workspaces")}
              >
                <Plus size={14} />
                Save a workspace
              </button>
            }
          >
            Bring related tabs together.
          </Empty>
        )}
      </Panel>
    ),
    focus: (
      <Panel
        title="A moment of focus"
        label="DO ONE THING WELL"
        action={
          <button
            className="icon-button"
            aria-label="Open focus"
            onClick={() => navigate?.("focus")}
          >
            <ArrowUpRight size={16} />
          </button>
        }
      >
        <FocusTimer a={a} run={run} mini />
      </Panel>
    ),
    notes: (
      <Panel
        title="On your mind"
        label="NOTES & LITTLE REMINDERS"
        action={
          <button
            className="icon-button"
            aria-label="Open notes"
            onClick={() => navigate?.("notes")}
          >
            <Plus size={16} />
          </button>
        }
      >
        {a.notes.length ? (
          <div className="note-preview">
            {a.notes.slice(0, 3).map((note) => (
              <button onClick={() => navigate?.("notes")} key={note.id}>
                <FileText size={16} />
                <span>
                  <strong>{note.title || "Untitled note"}</strong>
                  <small>{note.body.slice(0, 70) || "Your note"}</small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<FileText />}
            title="Catch a passing thought"
            action={
              <button
                className="text-button"
                onClick={() => navigate?.("notes")}
              >
                Write your first note
                <ArrowRight size={14} />
              </button>
            }
          >
            Keep something worth remembering.
          </Empty>
        )}
      </Panel>
    ),
    activity: (
      <Panel
        title="Your day, in perspective"
        label="LOCAL ACTIVITY"
        action={
          <button
            className="icon-button"
            aria-label="Open analytics"
            onClick={() => navigate?.("analytics")}
          >
            <ArrowUpRight size={16} />
          </button>
        }
      >
        {a.config.tracking ? (
          <div className="activity-summary">
            <strong className="metric">{duration(today)}</strong>
            <span className="muted">observed foreground browsing today</span>
            <div className="small-chart">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date(a.now);
                date.setDate(date.getDate() - 6 + i);
                const day = localDay(date.getTime());
                const seconds = a.activity
                  .filter((r) => r.day === day)
                  .reduce((n, r) => n + r.seconds, 0);
                const max = Math.max(60, ...week.days.map((r) => r.seconds));
                return (
                  <span
                    key={day}
                    title={`${day}: ${duration(seconds)}`}
                    style={{
                      height: `${Math.min(100, (seconds / max) * 100)}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <Empty
            icon={<BarChart3 />}
            title="Insights, on your terms"
            action={
              <button
                className="text-button"
                onClick={() => navigate?.("analytics")}
              >
                Set up local insights
                <ArrowRight size={14} />
              </button>
            }
          >
            Activity tracking is off. Your choice.
          </Empty>
        )}
      </Panel>
    ),
    sessions: (
      <Panel
        title="Pick up where you paused"
        label="SAVED SESSIONS"
        action={
          <LinkButton onClick={() => navigate?.("sessions")}>
            View all
          </LinkButton>
        }
      >
        {a.sessions.length ? (
          <div className="workspace-shortcuts">
            {a.sessions.slice(0, 3).map((row) => (
              <button key={row.id} onClick={() => navigate?.("sessions")}>
                <Archive size={18} />
                <span>
                  <strong>{row.name}</strong>
                  <small>
                    {row.tabs.length} tabs ·{" "}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Archive />}
            title="Good work deserves a bookmark"
            action={
              <button
                className="text-button"
                onClick={() => navigate?.("sessions")}
              >
                Save your first session
                <ArrowRight size={14} />
              </button>
            }
          >
            Save your tabs for another time.
          </Empty>
        )}
      </Panel>
    ),
  };
  return (
    <>
      <section className="dashboard-hero">
        <div className="hero-orbit" aria-hidden="true">
          <div />
          <div />
          <span className="orbit-core">
            <Sparkles size={34} strokeWidth={1} />
          </span>
          <i />
          <i />
        </div>
        <div className="hero-time">
          <span>
            {new Date(a.now).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <time>
            {new Date(a.now).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <span className="eyebrow hero-badge">
          <span className="status-dot" /> A LITTLE SPACE FOR BIG IDEAS
        </span>
        <h1>
          {greeting}
          {a.config.name ? `, ${a.config.name}` : ""}.
        </h1>
        <p>Less noise. More possibility. Make room for what matters.</p>
        <form
          className="hero-search"
          onSubmit={(e) => {
            e.preventDefault();
            run(search);
          }}
        >
          <Search size={20} />
          <input
            aria-label="Search the web or enter a URL"
            placeholder="Search the web or enter a URL"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Search"
            disabled={!installed || !query.trim()}
          >
            <ArrowRight size={18} />
          </button>
          <span className="search-divider" />
          <button
            className="command-trigger"
            type="button"
            onClick={command}
            aria-label="Open command search"
          >
            <Command size={14} />
            <kbd>K</kbd>
          </button>
        </form>
        <div className="hero-caption">
          <span className="status-dot" />
          Local-first. Yours, always.
        </div>
      </section>
      <div className="overview-strip" aria-label="Your browser at a glance">
        <button onClick={() => navigate?.("tabs")}>
          <Layers size={19} />
          <span>
            <strong>{a.tabs.length}</strong>
            <small>Open tabs</small>
          </span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => navigate?.("workspaces")}>
          <Briefcase size={19} />
          <span>
            <strong>
              {
                a.workspaces.filter((row) => !row.archived && !row.template)
                  .length
              }
            </strong>
            <small>Active spaces</small>
          </span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => navigate?.("focus")}>
          <Target size={19} />
          <span>
            <strong>{duration(focus.today)}</strong>
            <small>Focus today</small>
          </span>
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => navigate?.("privacy")}>
          <ShieldCheck size={19} />
          <span>
            <strong>Only yours</strong>
            <small>Stored on this device</small>
          </span>
          <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">THE EVERYDAY, REIMAGINED</span>
          <h2>Your personal command center</h2>
        </div>
        <button className="text-button" onClick={() => navigate?.("settings")}>
          Customize <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="daily-layout">
        <DayPlanner a={a} run={run} navigate={navigate} />
        <Panel
          className="launchpad"
          title="A better flow starts here"
          label="SMALL ACTIONS. MORE CLARITY."
        >
          <button onClick={() => navigate?.("focus")}>
            <span className="launch-icon">
              <Target size={20} />
            </span>
            <span>
              <strong>Find your focus</strong>
              <small>
                {focus.streak
                  ? `${focus.streak}-day streak. Keep the momentum.`
                  : "A quiet moment for your next big thing."}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => navigate?.("suggestions")}>
            <span className="launch-icon">
              <Sparkles size={20} />
            </span>
            <span>
              <strong>Clear the clutter</strong>
              <small>Discover ways to organize your tabs.</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={command}>
            <span className="launch-icon">
              <Command size={20} />
            </span>
            <span>
              <strong>Everything, a keystroke away</strong>
              <small>Search your tabs, notes, and spaces.</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </Panel>
      </div>
      <div className="dashboard-grid">
        {a.config.widgets.map((key) => (
          <div className={`widget widget-${key}`} key={key}>
            {widgets[key]}
          </div>
        ))}
      </div>
      {a.config.widgets.length === 0 && (
        <Panel>
          <Empty
            title="Your dashboard, your way"
            action={
              <button
                className="primary"
                onClick={() => navigate?.("settings")}
              >
                Choose widgets
              </button>
            }
          >
            Show widgets in Appearance settings.
          </Empty>
        </Panel>
      )}
    </>
  );
}
