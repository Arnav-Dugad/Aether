# Install and update

Download only from [official Aether releases](https://github.com/Arnav-Dugad/Aether/releases). Extract `aether-chromium-v0.1.1.zip` to a permanent folder before installing; `manifest.json` must be at that folder's root.

1. Open Chrome `chrome://extensions`, Edge `edge://extensions`, or Brave `brave://extensions`.
2. Enable Developer mode.
3. Click Load unpacked and select the extracted folder.
4. Check that Aether appears without an error and pin it to the toolbar.
5. Open a new tab for the dashboard. The toolbar opens the popup. Its expand action opens the full command center; the command center can open the side panel where supported.

Your browser may display developer-mode reminders. There is no published browser-store listing yet. Do not drag the ZIP into the browser and expect a silent installation.

## Update an unpacked copy

Export a backup in Privacy & data. Download the newer ZIP, replace the contents of the **same folder**, and click Reload on the browser's extensions page. Keep the folder path and installation identity stable to preserve local storage. Removing the extension clears its local data.

The Updates page checks official GitHub release metadata after you grant optional GitHub access. Downloads are ordinary official links. The UI does not claim observable download progress, checksum validation, or installation completion. Verify `SHA256SUMS.txt` yourself if desired:

```powershell
Get-FileHash .\aether-chromium-v0.1.1.zip -Algorithm SHA256
```

Store distribution can use native browser-managed updates in a future release. An unpacked extension cannot silently replace its executable code.

## Develop locally

Run `npm ci`, `npm run check`, and load `.output/chrome-mv3`. `npm run dev` uses WXT's development tooling. Node.js 22.12+ or 24 is supported. The committed lockfile is the authoritative tested dependency set.
