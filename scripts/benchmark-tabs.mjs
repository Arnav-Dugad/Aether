import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { build } from "esbuild";
const bundled = await build({
  entryPoints: ["src/lib/tabQuery.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { queryTabs } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].text).toString("base64")
);
const results = {
  environment: {
    node: process.version,
    platform: process.platform,
    kind: "Synthetic records; not a 1000-tab native browser test",
  },
  datasets: [],
};
let largest = [];
for (const count of [10, 100, 500, 1000]) {
  const tabs = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    index,
    windowId: 1,
    title: `Benchmark page ${index}`,
    url: `https://benchmark-${index % 20}.test/page/${index}`,
    active: false,
    incognito: false,
    pinned: false,
    highlighted: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    selected: false,
    groupId: -1,
  }));
  const options = {
    query: "benchmark page",
    filter: "all",
    sort: "title",
    windowId: null,
    workspaceId: null,
    assignments: {},
    workspaces: [],
  };
  for (let i = 0; i < 20; i++) queryTabs(tabs, [], options);
  const elapsed = [];
  for (let i = 0; i < 100; i++) {
    const at = performance.now();
    queryTabs(tabs, [], options);
    elapsed.push(performance.now() - at);
  }
  elapsed.sort((a, b) => a - b);
  results.datasets.push({
    records: count,
    queryMedianMs: Number(elapsed[50].toFixed(3)),
    queryP95Ms: Number(elapsed[95].toFixed(3)),
  });
  largest = tabs;
}
const root = resolve(".output/chrome-mv3");
const server = createServer((req, res) => {
  const path = resolve(
    root,
    "." + new URL(req.url, "http://localhost").pathname,
  );
  if (!path.startsWith(root + "/")) return res.writeHead(403).end();
  try {
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    res.setHeader(
      "content-type",
      mime[extname(path)] || "application/octet-stream",
    );
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(4181, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: process.env.AETHER_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.addInitScript((tabs) => {
  const event = { addListener() {}, removeListener() {} };
  const values = {
    config: { onboardingDone: true, surfaceViews: { app: "tabs" } },
  };
  Object.defineProperty(window, "chrome", {
    configurable: true,
    value: {
      runtime: {
        id: "benchmark-only",
        getManifest: () => ({ version: "benchmark" }),
        getURL: (path) => window.location.origin + path,
        sendMessage: async () => ({
          ok: false,
          error: "No mutations in synthetic benchmark",
        }),
      },
      tabs: {
        query: async () => tabs,
        onCreated: event,
        onRemoved: event,
        onUpdated: event,
        onActivated: event,
        onMoved: event,
        onAttached: event,
        onDetached: event,
      },
      windows: { getCurrent: async () => ({ id: 1 }) },
      storage: {
        local: { get: async () => values },
        session: { get: async () => ({}) },
        onChanged: event,
      },
      permissions: { contains: async () => false },
    },
  });
}, largest);
const at = performance.now();
await page.goto("http://127.0.0.1:4181/app.html");
await page.getByRole("heading", { name: "1000 tabs", exact: true }).waitFor();
results.render = {
  records: 1000,
  readyMs: Number((performance.now() - at).toFixed(1)),
  initialRows: await page.locator(".virtual-row").count(),
};
await page.locator(".virtual-list").evaluate((el) => {
  el.scrollTop = el.scrollHeight;
});
await page.getByText("Benchmark page 999", { exact: true }).waitFor();
results.render.endRows = await page.locator(".virtual-row").count();
results.render.horizontalOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
if (
  results.render.initialRows > 30 ||
  results.render.endRows > 30 ||
  results.render.horizontalOverflow
)
  throw new Error("Large-list render failed");
console.log(JSON.stringify(results, null, 2));
writeFileSync(
  "docs/benchmark-results.json",
  JSON.stringify(results, null, 2) + "\n",
);
await browser.close();
server.close();
