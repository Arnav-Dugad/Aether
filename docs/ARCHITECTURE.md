# Architecture

WXT builds four React-owned HTML entrypoints and an event-driven MV3 background worker. No content scripts or website injection are used.

- `entrypoints/`: new tab, popup, side panel, command center, and background lifecycle.
- `src/features/`: dashboard, tabs/performance/organization, saved collections/notes, focus, analytics, permission-gated library, settings/privacy, and updates.
- `src/components/`: semantic reusable panels/fields, browser tab list, native modal dialogs, command search, error boundary.
- `src/lib/`: typed browser adapter, Zod schemas and URL safeguards, IndexedDB database, React subscriptions, foreground accounting, and accent contrast calculations.
- `src/styles/glass.css`: centralized theme/material tokens and responsive layout.
- `src/styles/premium.css`: editorial dashboard, orbital illustration, chart/focus motion, and responsive refinements.
- `src/lib/insights.ts`: local calendar ranges, domain aggregation, baseline comparisons, and completion-day focus streaks.

## Material design

Local CSS gradients supply the background. Surface tint and blur are configurable independently through material alpha and blur tokens. Typical frosting is about 25px, with saturation kept modest. Sidebar, search bar, panels, and dialogs share this material family. Decorative orbital/breathing motion animates transforms and opacity; there is no animated lensing, refraction, or reflective surface animation.

Opaque mode and OS reduced-transparency settings remove frosting; high contrast strengthens text/borders and uses opaque materials. Unsupported backdrop filters fall back to opaque surfaces. Modal opening animates transform/opacity only and honors reduced motion. Fonts use native system stacks; Apple's proprietary fonts are not redistributed.

## Data

Dexie/IndexedDB version 2 (with a non-destructive, tested v1 migration) holds workspaces, sessions, notes, aggregated activity by local day/domain, completed focus sessions, and URL label/favorite/protection metadata. Browser local storage holds small validated preferences, a durable focus timestamp, and last observed foreground state. No sync storage is used.

The worker registers event listeners at startup. Tab activation/navigation, focused windows, idle state, and minute alarms reconcile observed activity. Operations are queued to avoid double accounting. Intervals over 90 seconds are excluded after suspension. Midnight splits use local calendar boundaries. The worker does not use a permanent interval.

Live workspace assignments and the last supported tab undo record use browser session storage. A browser restart clears those associations; persistent saved URLs remain. Tab mutations and cross-surface preference changes run through validated, extension-owned messages serialized by the worker. Virtualized rows keep the rendered tree bounded for large collections.

Focus completion uses a saved end timestamp and a browser alarm. The UI refreshes its displayed clock while open, and completed sessions are inserted with a stable timestamp key to avoid duplicate history rows.

Daily priorities reuse Notes with due dates and completion flags, so portable backups include them without a database migration. Calendar aggregation is memoized by local day and record changes, independently of the one-second timer refresh. Activity charts fill missing days with zero; period comparisons use consecutive calendar windows and include today's partial day. Focus streaks use completion dates and allow yesterday as their endpoint until today's first completed session.

## Boundaries

Chrome APIs are called from extension pages. Permissions for bookmarks/history/browser search and GitHub host access are requested from user interactions. Incognito tabs are filtered. Imported links allow only HTTP(S). Imported data is validated and rendered through React. Notes support a safe Markdown subset using text nodes and HTTP(S)-only links; raw HTML is never executed. Release Markdown is displayed as plain text. The CSP excludes remote scripts and object embedding.

This version intentionally keeps organization suggestions user-triggered. Native groups are distinct from saved workspace URL collections. More invasive automation and AI are future work.
