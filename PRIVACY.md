# Privacy policy

Aether stores preferences, workspace/session URL metadata, notes, optional foreground domain activity, URL labels/favorites/protection, small recent-command IDs, session-only tab ownership/undo metadata, and completed focus records locally in extension storage and IndexedDB. There is no telemetry, advertising, tracking service, login, cloud account, or data sale.

Activity tracking is disabled by default. When enabled, it records domains and approximate observed foreground durations while the browser window is focused and the device is not classified idle. No webpage content, passwords, or incognito activity is collected. Workspace/session snapshots exclude private and internal pages. Saved URLs can contain sensitive parameters; export backups with care.

Bookmarks and history require optional browser permission when the feature is opened. They are read for local presentation; no historical foreground-time inference is made. Web search uses the browser's default provider only with the optional search permission.

Manual release checks request optional host access to `api.github.com`, fetching public releases for `Arnav-Dugad/Aether`. GitHub receives an ordinary network request (including IP address). No tabs, history, notes, or activity are sent. Downloads navigate to official GitHub release links. There is no background update polling in this release.

Privacy & data provides backup import/export, permission revocation, and local data deletion. Deletion does not remove native browser bookmarks/history. Uninstalling the extension removes its local data. Portable backups exclude activity and completed focus history; activity has a separate CSV export.

Notes autosave locally. Already-granted bookmark/history permissions also allow local command indexing when you open search. Command history records bounded local entity IDs; it is not uploaded. Live ownership and undo records clear when the browser session ends. URL metadata is included in portable backups.
