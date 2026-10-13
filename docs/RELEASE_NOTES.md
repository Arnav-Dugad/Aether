# Aether 0.3.0 — A clearer day

A redesigned browser command center with daily priorities, richer private insights, and a calmer place to focus.

## What's new

- Editorial dashboard with larger typography, a live browser summary, action launchpad, refined glass cards, and an original animated orbital illustration.
- Daily priorities: add from Overview, complete/reopen, see overdue items, and edit in Notes. Priorities share the existing local database and portable backups.
- Focus presets for 15/25/45/60 minutes, configurable daily goals, completion-day streaks, weekly consistency markers, and an immersive dialog with soft breathing motion.
- Insights ranges for 7/30/90 days, daily averages, previous-period changes, ranked website shares, completed focus totals, and a 91-day activity map. CSV exports respect the selected range.
- Polished navigation, hover responses, staggered widget entrances, chart growth, and smooth timer progress. In-app Reduce motion and operating-system preferences both stop decorative motion.
- Improved Windows keyboard hints and explicit accessible names on new controls.
- Cross-platform Node ZIP packaging; Python is no longer required. Updated screenshots and a maintained premium roadmap.

## Download and install

Download **aether-chromium-v0.3.0.zip**, extract it, enable Developer mode at `chrome://extensions` (or your Chromium browser's extension page), and choose **Load unpacked** on the folder containing `manifest.json`.

For an existing installation, back up your data in Privacy & data, replace files in the same installed folder, and reload Aether. Do not uninstall or load it from another folder if you want to preserve local data.

The release includes source code, a release manifest, and SHA-256 checksums. It is a manual-install package; there is no browser-store auto-update.

## Privacy and limits

No account, telemetry, new permissions, or remote analytics. Browsing activity remains off by default. Focus does not block websites or support pause/break cycles yet. Activity is approximate foreground domain time. Comparisons include today's partial day; no baseline produces no percent claim. Streaks use completed sessions attributed to their local completion date.

## Validation

Strict TypeScript, ESLint, 43 logic tests, native Chromium integration tests, production build, ZIP-root/checksum verification, and four-surface layout/accessibility checks. CI validates the exact pushed commit before publishing.
