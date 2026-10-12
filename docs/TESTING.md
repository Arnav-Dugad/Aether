# Validation evidence

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
