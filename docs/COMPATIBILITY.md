# Compatibility

| Browser                        | Target                      | Evidence                                                                                               |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Chromium / Chrome 116+         | Primary extension target    | Full native smoke suite configured in GitHub CI; see Actions for actual pass/fail                      |
| Headless Chromium 138 (Linux)  | Layout validation           | Four HTTP-served surfaces rendered without overflow or page errors; this binary cannot load extensions |
| Chrome on Windows 11           | Primary end-user target     | Not tested on an available Windows machine                                                             |
| Microsoft Edge                 | Target                      | API capability checks and shared Chromium packaging; not directly tested                               |
| Brave                          | Target                      | Shared Chromium packaging; not directly tested                                                         |
| Vivaldi / Opera                | Conditional target          | Side panel/API/permission support may differ; not directly tested                                      |
| macOS / Linux desktop browsers | Portable code               | No native-platform integration; desktop compatibility not certified                                    |
| Firefox / Safari               | Not supported by this build | Separate adapters/builds would be required                                                             |

At runtime, Aether uses a popup-window fallback when `chrome.sidePanel.open` is absent. If a browser rejects the `sidePanel` manifest permission entirely, the shared build may fail to install; a separate browser-specific manifest is still needed. Native grouping and recently closed restoration depend on browser API support.
