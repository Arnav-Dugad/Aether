import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, extname, relative, isAbsolute } from "node:path";
const buildRoot = resolve(".output/chrome-mv3");
const server = createServer((request, response) => {
  const path = resolve(
    buildRoot,
    "." + new URL(request.url, "http://localhost").pathname,
  );
  const within = relative(buildRoot, path);
  if (within.startsWith("..") || isAbsolute(within)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    response.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    response.end(readFileSync(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(4179, "127.0.0.1", resolve));
// HTTP-only layout checks. These do not claim to test extension APIs.
const browser = await chromium.launch({
  executablePath: process.env.AETHER_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
mkdirSync("docs/screenshots", { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:4179/app.html");
await page
  .getByRole("heading", { name: /Good (morning|afternoon|evening)/ })
  .waitFor();
await page.screenshot({
  path: "docs/screenshots/overview.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("button", { name: "Appearance", exact: true }).click();
await page.getByRole("heading", { name: "Make it feel like you" }).waitFor();
await page.screenshot({
  path: "docs/screenshots/appearance.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("button", { name: "Obsidian", exact: true }).click();
await page.screenshot({
  path: "docs/screenshots/dark.png",
  fullPage: true,
  animations: "disabled",
});
const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  .analyze();
console.log(
  "Accessibility violations:",
  results.violations.map((v) => ({
    id: v.id,
    description: v.description,
    nodes: v.nodes.map((n) => ({ target: n.target, detail: n.failureSummary })),
  })),
);
for (const surface of ["app", "newtab", "popup", "sidepanel"]) {
  const view = await context.newPage();
  await view.setViewportSize({
    width: surface === "popup" ? 400 : 360,
    height: 800,
  });
  await view.goto(`http://127.0.0.1:4179/${surface}.html`);
  await view.locator(".panel").first().waitFor();
  console.log(
    surface,
    "horizontal overflow:",
    await view.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  );
  const audit = await new AxeBuilder({ page: view })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  console.log(
    surface,
    "accessibility:",
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
  if (audit.violations.length)
    errors.push(`${surface}: accessibility violations`);
  if (surface === "popup")
    await view.screenshot({
      path: "docs/screenshots/popup.png",
      fullPage: true,
      animations: "disabled",
    });
  await view.close();
}
await page.getByRole("button", { name: "Overview", exact: true }).click();
await page.screenshot({
  path: "docs/screenshots/dark-overview.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("button", { name: "Focus", exact: true }).click();
await page.getByRole("heading", { name: "Make room for deep work." }).waitFor();
await page.screenshot({
  path: "docs/screenshots/focus.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("button", { name: "Insights", exact: true }).click();
await page
  .getByRole("heading", { name: "Small moments, a bigger picture" })
  .waitFor();
await page.screenshot({
  path: "docs/screenshots/insights.png",
  fullPage: true,
  animations: "disabled",
});
console.log("Page errors:", errors);
await browser.close();
server.close();
if (errors.length || results.violations.length) process.exitCode = 1;
