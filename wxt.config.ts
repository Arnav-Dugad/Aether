import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Aether — Your browser. Elevated.",
    description:
      "A private, local-first browser command center with classic frosted glass.",
    version: "0.1.0",
    minimum_chrome_version: "116",
    permissions: [
      "tabs",
      "storage",
      "alarms",
      "sessions",
      "idle",
      "sidePanel",
      "tabGroups",
    ],
    optional_permissions: ["bookmarks", "history", "search"],
    optional_host_permissions: ["https://api.github.com/*"],
    commands: {
      "open-command-center": {
        suggested_key: { default: "Ctrl+Shift+Space" },
        description: "Open Aether command center",
      },
    },
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none';",
    },
  },
});
