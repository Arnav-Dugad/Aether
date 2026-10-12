# Feature status — 0.1.0

The user supplied a broad browser operating-system brief. This first release establishes a working extension and the requested classic Apple-inspired frosted UI. It is not the completed browser operating system described by that brief.

| Area              | Implemented                                                                                                                           | Remaining                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Surfaces          | New tab, popup, side panel, full center, responsive navigation                                                                        | Persisted per-surface navigation and full onboarding tutorial                                    |
| Appearance        | 5 live themes, custom accents with readable text variants, adjustable frosting, opaque/high-contrast/compact modes, OS reduced motion | Theme schedules, custom presets, wallpaper import/palette extraction, bundled typography         |
| Dashboard         | Greeting/clock, browser-provider search after permission, six togglable/reorderable widgets                                           | Drag/resize, custom widget gallery, pinned/frequent websites                                     |
| Tabs              | Live cross-window list, paginated large lists, title/URL search, pin/close, duplicates review, recently closed restoration            | Virtualization, multi-select/bulk move, labels, custom sorting and alternate views               |
| Workspaces        | Save current web tabs, names/colors, duplicate/export/delete, restore selected tabs in new windows                                    | Live tab ownership, switching contexts, templates, archives and workspace-specific notes/rules   |
| Sessions          | Manual saves, opt-in 15-minute snapshots, unchanged-URL deduplication, latest-100 retention, selective multi-window restoration       | Snapshot comparisons/tags/timeline, progress reporting, pinned/window-change deduplication       |
| Notes             | Create/edit/save/delete and completion checkoff                                                                                       | Autosave, markdown rendering, workspace linkage, task priorities/dates                           |
| Focus             | Timestamp-based timer, configurable presets, completed history, cancel                                                                | Pause/resume, Pomodoro breaks, website blocking, scheduled focus                                 |
| Analytics         | Opt-in approximate foreground domain time, idle awareness, local-day splitting, weekly chart/top sites/CSV export                     | Heatmaps, custom date ranges, workspace/category analytics, tab-count/event trends, retention UI |
| Bookmarks/history | Explicit optional access, read/search/open                                                                                            | Folder navigation, editing/tags, history date filters and pagination                             |
| Performance       | Actual tab/discard/audio counts, manual safe-guarded discard review                                                                   | Protected-domain rules, inactivity policies, storage statistics                                  |
| Organization      | Explainable domain-group suggestions and user-initiated native grouping                                                               | Full declarative automation engine, dry-run logs, undo                                           |
| Search            | Keyboard command search and open-tab search                                                                                           | Fuzzy indexed universal bookmark/history/session search and command history                      |
| Updates           | Permission-gated manual official release discovery and notes/package links                                                            | Background release checks, caching/backoff, download monitoring and checksum verification in-app |
| Local AI          | None; core features work without AI                                                                                                   | Optional Ollama integration and explicit data consent                                            |
| Data              | IndexedDB schema v1, Zod backup validation, transactional portable imports, CSV export and clear-data action                          | Quota/corruption recovery, migration tests for future schemas, granular retention controls       |

## Important limits

- Workspace restoration opens a saved collection in new windows. It does not emulate browser-native workspace switching.
- Session snapshots contain URL/title/pinned/window metadata, not unsaved forms, page content, cookies, authentication, or browser-internal pages.
- Foreground measurements are approximate. Gaps over 90 seconds are ignored. Browser history does not provide historical foreground duration.
- Tabs with detected audio, pinned/active tabs, and browser-protected tabs are excluded from discard candidates. Not every download or unsaved form can be detected without intrusive site access. Review before discarding.
- The popup shares the core UI bundle. Heavy settings/library modules are lazy, but it is not yet a separately optimized minimal popup bundle.
- No store publishing, auto-installation, mandatory AI, arbitrary script automation, or per-tab CPU/GPU/RAM estimation exists.
- Full native browser operation depends on API availability. Linux headless layout checks alone do not establish Windows or cross-browser compatibility.
