# Aether development preferences

- Working checkout: `Arnav-Dugad/Aether`. Preserve existing features, user data, and local-first privacy.
- The user requests substantial improvements to features, design, UI, visuals, analytics, and animations. Deliver usable workflows with truthful data and accessible empty states.
- After completing and validating authorized development, commit and push to GitHub, bump package/manifest versions together, and publish a new downloadable release. The user explicitly requests this workflow. Never overwrite old releases or force-push.
- Run `npm run check` and native Chromium tests for feature changes. CI gates releases on these checks. Review light/dark and narrow screenshots. Respect reduced motion, contrast, and transparency settings.
- Update `docs/RELEASE_NOTES.md`, CHANGELOG, status, installation references, and validation evidence as applicable. `npm run package` creates the extension ZIP and checksums in `dist/`.
- Every delivery response should include a substantial list of proposed premium features, UI improvements, data/analytics enhancements, visuals, and animations. Distinguish proposals from shipped features. Maintain `docs/ROADMAP.md`.
- Avoid telemetry, new remote services, paid dependencies, fabricated analytics, and unnecessarily broad browser permissions.
