# Validation evidence

## 0.3.0 Windows validation

- Node.js/npm in the user's Windows workspace; strict TypeScript and ESLint pass.
- 43 Vitest logic tests pass, including local calendar ranges, nonoverlapping comparisons, missing-data behavior, focus completion-day attribution/streaks, and migration of new preferences.
- Native Chromium tests cover priorities backed by Notes, complete/reopen/persistence, preset persistence, immersive keyboard dismissal, timer persistence after reload, range controls, new preference persistence, and populated charts/range-filtered CSV downloads, alongside the existing tabs/workspaces/notes suite.
- The loaded MV3 extension was exercised using an existing full Chromium installation through `AETHER_CHROMIUM_EXECUTABLE`. CI uses the Playwright-managed Chromium binary. Set this environment variable only when testing with another installed full Chromium executable.
- `scripts/visual-check.mjs` reports zero page errors, zero horizontal overflow, and zero WCAG-tagged axe violations for tested app/newtab/popup/sidepanel views. Light/dark/Focus/Insights screenshots were rendered and inspected. Automated checks do not certify every accessibility scenario or browser.
- Production packaging uses Node ZIP creation, validates matching manifest/package versions, emits a root-level manifest and SHA-256 checksum, and does not require Python.
- Older validation evidence below refers to prior releases; current GitHub Actions evidence is linked with the release delivery.

## Executed locally

- Node.js 24.19.0, npm 11.9.0, Linux container.
- Strict TypeScript validation and ESLint.
- Eleven Vitest logic tests: unsafe URLs, private/internal snapshot exclusion, duplicate semantics, backup/version validation, preferences, numeric release comparison, timestamp-based focus, worker gaps, and local midnight accounting.
- Production WXT MV3 build and ZIP-root validation.
- Dependency audit: zero reported production vulnerabilities at the first check; a later full-development audit identified Vitest advisories, resolved by updating to 4.1.11. The final full audit reports zero vulnerabilities.
- HTTP-served built UI rendered in headless Chromium 138.0.7204.0: four surfaces at narrow widths, no page exceptions or horizontal overflow. Appearance audit and per-surface WCAG-tagged axe checks are run by `scripts/visual-check.mjs`; **zero violations were reported for those tested views after contrast/label fixes**. This is an automated check, not a full accessibility certification.
- Screenshots inspected for light/dark material consistency and visual layout.

## Native extension testing

The standard Playwright Chromium download failed locally with a truncated archive. A separately available headless-shell binary could render the UI but did not load extension workers. Therefore native tab operations, Chrome permissions, alarms, worker suspension, and extension-owned IndexedDB integration were **not locally validated in a real loaded extension**.

`tests/e2e/extension.spec.ts` launches full Chromium with Aether installed. It checks onboarding, computed frosting, persistent theme/opaque settings, native tabs, saved workspaces/restoration, notes, keyboard command search, and four surface layouts/accessibility. GitHub CI runs this suite; the Actions result is authoritative. Do not describe the suite as passed until the run passes.

Not tested: Edge, Brave, Vivaldi, Opera, Windows 11, live releases on multiple installation sources, long-duration background accounting, or 1,000-tab browser responsiveness. No benchmark claim is made for those environments.

## Native CI findings and repairs

The first native run successfully loaded the extension and passed notes/keyboard search and the four-surface accessibility/layout suite. It exposed delayed controlled-switch feedback and a changing navigation accessible name. Appearance changes now update immediately and persist through a serialized write queue; a regression test verifies concurrent preferences. Navigation controls have stable labels. The [native rerun](https://github.com/Arnav-Dugad/Aether/actions/runs/38287956604) passed all four tests, and the release job succeeded. It validated persisted themes/opaque settings, real browser tabs and workspace restoration, notes/keyboard search, and all four surfaces with axe checks. The 0.1.1 patch reruns the same gated suite before publishing.

## 0.2.0 validation

The extended suite covers the v1-to-v2 migration, tab protection/safety and disappeared IDs, native-group/move/close undo, ownership, note write ordering/commit feedback/deletion, incremental search, valid calendar dates and view imports. Native tests additionally exercise bulk actions, workspace editing/archives/templates, reversible restore selection, autosave/Escape/delete, cross-surface preferences, multiple tab layouts, and command labels.

The [synthetic benchmark](benchmark-results.json) uses 10/100/500/1,000 fixture records exclusively in test code. The 1,000-record query median was 5.343 ms, with 14 initially rendered virtual rows and 14 at the end, and no horizontal overflow. Browser layout readiness was 279.7 ms in the Linux Chromium 138 container. This does not measure a browser with 1,000 actual loaded pages or certify Windows performance. Native CI results are authoritative for the full extension test suite.
