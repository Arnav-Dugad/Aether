# Security

Use current Chromium browsers and official release packages. This release has no content scripts, remote executable code, `eval`, tokens, or mandatory external services. Its extension CSP permits local scripts only. Imported backups are size-bounded and schema-validated. Links are restricted to HTTP(S). Untrusted text is rendered through React; release notes are plain text. Notes use a safe React Markdown subset without executable HTML. Worker mutation/preference messages require the extension’s own sender identity and URL, are schema-validated, and are serialized; protections are rechecked just before destructive tab actions.

Permissions:

| Permission                     | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| tabs                           | Read tab metadata, activate, pin, close, restore, and discard reviewed tabs |
| storage                        | Local preferences and durable timer/foreground state                        |
| alarms                         | Timer completion, minute observation, opt-in snapshots                      |
| sessions                       | Recently closed recovery                                                    |
| idle                           | Exclude observed idle time from optional activity                           |
| sidePanel                      | Own extension side-panel surface                                            |
| tabGroups                      | User-initiated grouping suggestions                                         |
| bookmarks (optional)           | Read the user's bookmark library                                            |
| history (optional)             | Search recent native browser history                                        |
| search (optional)              | Use the browser's configured web search provider                            |
| api.github.com host (optional) | User-initiated official release checks                                      |

No general website host permission is requested. Incognito operation is not supported. Exact form/download safety cannot be inferred from tab metadata; review discard candidates and save page work first.

Report security concerns privately through GitHub's private vulnerability reporting if enabled. If unavailable, contact the repository owner through a verified private channel; do not publish secrets or exploit details in a public issue. No independent security audit or WCAG certification is claimed.
