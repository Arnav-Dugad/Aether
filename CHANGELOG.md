# Changelog

## 0.3.0

- Redesign Overview with refined glass, editorial typography, animated orbital art, browser summary, and a connected launchpad.
- Add daily priorities backed by Notes, with overdue visibility and complete/reopen controls.
- Add focus presets, daily goals, completion-day streaks, weekly consistency, and immersive focus.
- Extend Insights with 7/30/90-day ranges, averages, baseline comparisons, website shares, range-aware CSV, and a 91-day activity map.
- Add persistent Reduce motion, polish interactions, respect system motion preferences, and correct Windows keyboard hints.
- Replace Python packaging with cross-platform Node ZIP creation; validate native workflows on Windows and refresh screenshot evidence.
- Maintain release notes and a 60-item proposed premium roadmap.

## 0.2.0

- Add virtualized multi-select tab management, list/card/domain/window layouts, sorting, URL labels/favorites/protection, guarded bulk pin/move/group/assign/close/discard, and supported undo.
- Add editable workspaces, descriptions, archives/templates, explicit live tab ownership, selective restore with real progress, and session comparison.
- Add serialized debounced note autosave, workspace/URL links, priority/dates, safe Markdown preview, and save-failure recovery.
- Add incremental fuzzy command search across tabs, workspaces, sessions, notes, and already-permitted browser bookmarks/history; include prefixes and actual recent selections.
- Persist per-surface navigation and serialize preference updates in the worker across open surfaces.
- Migrate IndexedDB v1 to v2 without discarding saved work; retain compatibility with v1 portable backups and include URL metadata in exports.
- Extend migration, safety, autosave, search, and native browser tests. Document a synthetic 1,000-record rendering benchmark separately from native browser tab testing.

## 0.1.1

- Guard appearance state against stale reads during rapid preference changes.
- Keep immediate switch feedback and serialized local writes.
- Ship the latest code as a separate patch package without replacing the first release.

## 0.1.0

Initial functional Aether foundation in the existing `Arnav-Dugad/Aether` repository.

- Classic frosted-glass design across the new tab, popup, side panel, and command center.
- Live themes, glass controls, reduced transparency/high contrast, responsive layouts, and keyboard dialogs.
- Tab management, saved workspace/session collections, notes, timestamp-based focus, local opt-in activity, optional bookmarks/history, and official manual release discovery.
- Typed local storage, validated portable backups, privacy controls, tests, and versioned packaging/CI.

This is not the completed feature set of the original browser-OS brief; see docs/STATUS.md.
