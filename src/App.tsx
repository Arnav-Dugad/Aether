import { Suspense, lazy, useEffect, useState, type CSSProperties } from "react";
import {
  LayoutDashboard,
  Layers,
  Briefcase,
  Archive,
  Bookmark,
  BarChart3,
  Moon,
  NotebookPen,
  Settings,
  Search,
  ShieldCheck,
  Download,
  History,
  Command,
  ArrowUpRight,
  Menu,
  X,
  Zap,
  Sparkles,
  CircleHelp,
} from "lucide-react";
import packageInfo from "../package.json";
import { accentColors } from "./lib/colors";
import { useAether } from "./lib/useAether";
import { installed, center, sidePanel } from "./lib/browser";
import { Dashboard } from "./features/Dashboard";
const Tabs = lazy(() =>
  import("./features/Tabs").then((m) => ({ default: m.Tabs })),
);
import { CommandPalette } from "./components/CommandPalette";
import { Field, Modal, Panel } from "./components/ui";
import "./styles/glass.css";
const Collections = lazy(() =>
  import("./features/Collections").then((m) => ({ default: m.Collections })),
);
const Notes = lazy(() =>
  import("./features/Collections").then((m) => ({ default: m.Notes })),
);
const SettingsPage = lazy(() =>
  import("./features/Settings").then((m) => ({ default: m.Settings })),
);
const Privacy = lazy(() =>
  import("./features/Settings").then((m) => ({ default: m.Privacy })),
);
const Analytics = lazy(() =>
  import("./features/Analytics").then((m) => ({ default: m.Analytics })),
);
const Focus = lazy(() =>
  import("./features/Focus").then((m) => ({ default: m.Focus })),
);
const Library = lazy(() =>
  import("./features/Library").then((m) => ({ default: m.Library })),
);
const Updates = lazy(() =>
  import("./features/Updates").then((m) => ({ default: m.Updates })),
);
const Performance = lazy(() =>
  import("./features/Tabs").then((m) => ({ default: m.Performance })),
);
const Suggestions = lazy(() =>
  import("./features/Tabs").then((m) => ({ default: m.Suggestions })),
);
const navigation = [
  {
    id: "dashboard",
    name: "Overview",
    icon: LayoutDashboard,
    group: "BROWSER",
  },
  { id: "tabs", name: "Tabs", icon: Layers },
  { id: "workspaces", name: "Workspaces", icon: Briefcase },
  { id: "sessions", name: "Sessions", icon: Archive },
  { id: "bookmarks", name: "Bookmarks", icon: Bookmark },
  { id: "history", name: "History", icon: History },
  { id: "analytics", name: "Insights", icon: BarChart3, group: "YOUR DAY" },
  { id: "focus", name: "Focus", icon: Moon },
  { id: "notes", name: "Notes", icon: NotebookPen },
  { id: "performance", name: "Performance", icon: Zap },
  { id: "suggestions", name: "Organize", icon: Sparkles },
  { id: "settings", name: "Appearance", icon: Settings, group: "PREFERENCES" },
  { id: "privacy", name: "Privacy & data", icon: ShieldCheck },
  { id: "updates", name: "Updates", icon: Download },
];
export default function App({
  surface = "app",
}: {
  surface?: "app" | "newtab" | "popup" | "sidepanel";
}) {
  const a = useAether();
  const [page, setPage] = useState(
    surface === "popup" || surface === "sidepanel" ? "tabs" : "dashboard",
  );
  const [palette, setPalette] = useState(location.hash === "#command");
  const [mobile, setMobile] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(0);
  const [onboarding, setOnboarding] = useState(false);
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), failed ? 9000 : 4500);
      return () => clearTimeout(timer);
    }
  }, [message, failed]);
  useEffect(() => {
    if (
      a.ready &&
      !a.config.onboardingDone &&
      installed &&
      surface !== "popup" &&
      surface !== "sidepanel"
    )
      setOnboarding(true);
  }, [a.ready, a.config.onboardingDone, surface]);
  function run(work: () => Promise<unknown>, success?: string) {
    setBusy((v) => v + 1);
    void work()
      .then(() => {
        if (success) {
          setFailed(false);
          setMessage(success);
        }
      })
      .catch((error) => {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy((v) => Math.max(0, v - 1)));
  }
  function navigate(value: string) {
    setPage(value);
    setMobile(false);
  }
  const props = { a, run, navigate };
  const current = navigation.find((item) => item.id === page)!;
  const accents = accentColors(a.config.accent);
  const style = {
    "--accent-light": accents.light,
    "--accent-dark": accents.dark,
    "--accent-fill": accents.fill,
    "--accent": a.config.accent,
    "--blur": `${Math.round(a.config.glass * 0.36)}px`,
    "--material-alpha": String(0.96 - a.config.glass * 0.0037),
    "--sidebar-alpha": String(0.95 - a.config.glass * 0.005),
  } as CSSProperties;
  const content = (() => {
    switch (page) {
      case "tabs":
        return <Tabs {...props} />;
      case "workspaces":
        return <Collections {...props} kind="workspaces" />;
      case "sessions":
        return <Collections {...props} kind="sessions" />;
      case "notes":
        return <Notes {...props} />;
      case "settings":
        return <SettingsPage {...props} />;
      case "privacy":
        return <Privacy {...props} />;
      case "analytics":
        return <Analytics {...props} />;
      case "focus":
        return <Focus {...props} />;
      case "bookmarks":
        return <Library {...props} kind="bookmarks" />;
      case "history":
        return <Library {...props} kind="history" />;
      case "updates":
        return <Updates {...props} />;
      case "performance":
        return <Performance {...props} />;
      case "suggestions":
        return <Suggestions {...props} />;
      default:
        return <Dashboard {...props} command={() => setPalette(true)} />;
    }
  })();
  return (
    <div
      className={`aether surface-${surface} ${a.config.compact ? "compact" : ""}`}
      data-theme={a.config.theme}
      data-opaque={a.config.reducedTransparency}
      data-contrast={a.config.highContrast}
      style={style}
      aria-busy={busy > 0}
    >
      <div className="wallpaper" aria-hidden="true" />
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-mark">
            <span />
          </span>
          <span>
            Aether<small>YOUR BROWSER, ELEVATED</small>
          </span>
        </a>
        <button className="sidebar-search" onClick={() => setPalette(true)}>
          <Search size={15} />
          <span>Quick search</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <div key={item.id}>
              {item.group && <p className="nav-label">{item.group}</p>}
              <button
                className={`nav-item ${page === item.id ? "selected" : ""}`}
                aria-label={item.name}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={17} />
                <span>{item.name}</span>
                {item.id === "tabs" && (
                  <span className="nav-count">{a.tabs.length}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>
            Everything stays with you
            <small>Local-first · No account needed</small>
          </span>
          <ShieldCheck size={16} />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={18} />
            </button>
            <span>Aether</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current.name}</strong>
          </div>
          <div className="topbar-actions">
            {busy > 0 && (
              <span className="working" role="status">
                Working…
              </span>
            )}
            <button
              className="topbar-command"
              aria-label="Open command search"
              onClick={() => setPalette(true)}
            >
              <Command size={14} />
              <span>Command search</span>
              <kbd>⌘ K</kbd>
            </button>
            {surface !== "app" && (
              <button
                className="icon-button"
                aria-label="Open command center"
                onClick={center}
              >
                <ArrowUpRight size={18} />
              </button>
            )}
            {surface === "app" && (
              <button
                className="icon-button"
                aria-label="Open side panel"
                onClick={() => run(sidePanel)}
              >
                <Layers size={17} />
              </button>
            )}
          </div>
        </header>
        {(surface === "popup" || surface === "sidepanel") && (
          <div className="compact-nav" aria-label="Quick navigation">
            {[
              "tabs",
              "workspaces",
              "sessions",
              "focus",
              "notes",
              "settings",
            ].map((id) => {
              const item = navigation.find((n) => n.id === id)!;
              return (
                <button
                  key={id}
                  aria-label={item.name}
                  aria-pressed={page === id}
                  onClick={() => navigate(id)}
                >
                  <item.icon size={18} />
                </button>
              );
            })}
          </div>
        )}
        <div className="main-content">
          {!installed && (
            <div className="preview-notice">
              <CircleHelp size={16} />
              Browser data is available when Aether is installed as an
              extension.
            </div>
          )}
          {page !== "dashboard" && (
            <header className="page-heading">
              <span className="eyebrow">
                AETHER / {current.group ?? "YOUR SPACE"}
              </span>
              <h1>
                {current.name === "Appearance"
                  ? "A little more you."
                  : current.name}
              </h1>
            </header>
          )}
          {a.error && (
            <p role="alert" className="error-notice">
              {a.error}
            </p>
          )}
          <Suspense
            fallback={
              <Panel>
                <p role="status" className="muted">
                  Opening your space…
                </p>
              </Panel>
            }
          >
            {a.ready ? (
              content
            ) : (
              <Panel>
                <p role="status">Getting your space ready…</p>
              </Panel>
            )}
          </Suspense>
          <footer className="page-footer">
            <span>Aether</span>
            <span>A little clarity goes a long way.</span>
            <span>
              v
              {installed
                ? chrome.runtime.getManifest().version
                : packageInfo.version}
            </span>
          </footer>
        </div>
      </main>
      {palette && (
        <CommandPalette {...props} onClose={() => setPalette(false)} />
      )}{" "}
      {message && (
        <div
          className={`toast ${failed ? "error" : ""}`}
          role={failed ? "alert" : "status"}
        >
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {onboarding && (
        <Modal
          title="A little clarity for your browser."
          onClose={() => {
            run(() => a.patchConfig({ onboardingDone: true }));
            setOnboarding(false);
          }}
        >
          <div className="onboarding-mark">
            <span className="brand-mark">
              <span />
            </span>
          </div>
          <p>
            Meet Aether. Your tabs, saved spaces, focus, and thoughts, together
            in one quiet place.
          </p>
          <Field label="What should we call you? (optional)">
            <input
              autoFocus
              maxLength={50}
              placeholder="Your name"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
            />
          </Field>
          <div className="onboarding-privacy">
            <ShieldCheck size={22} />
            <span>
              Local-first. No accounts. No telemetry.
              <small>
                Activity tracking starts off. Optional permissions are requested
                only when you use a feature.
              </small>
            </span>
          </div>
          <button
            className="primary full"
            onClick={() => {
              run(() =>
                a.patchConfig({ name: greeting, onboardingDone: true }),
              );
              setOnboarding(false);
            }}
          >
            Make yourself at home
            <ArrowUpRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
