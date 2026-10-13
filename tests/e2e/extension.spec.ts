import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import AxeBuilder from "@axe-core/playwright";
let context: BrowserContext, page: Page, origin: string, profile: string;
const errors: string[] = [];
test.beforeAll(async () => {
  profile = await mkdtemp(`${tmpdir()}/aether-e2e-`);
  const extension = resolve(".output/chrome-mv3");
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    executablePath: process.env.AETHER_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  origin = `chrome-extension://${new URL(worker.url()).hostname}`;
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/app.html`);
  await page.getByRole("button", { name: "Make yourself at home" }).click();
});
test.afterAll(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});
test("fresh installation, materials, themes, and persisted preferences", async () => {
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  expect(
    await page
      .locator(".panel")
      .first()
      .evaluate((el) => getComputedStyle(el).backdropFilter),
  ).toContain("blur");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "Obsidian", exact: true }).click();
  await expect(page.locator(".aether")).toHaveAttribute(
    "data-theme",
    "obsidian",
  );
  await page.getByLabel("Reduce transparency", { exact: false }).check();
  await expect(page.locator(".aether")).toHaveAttribute("data-opaque", "true");
  await page.reload();
  await expect(page.locator(".aether")).toHaveAttribute(
    "data-theme",
    "obsidian",
  );
  await expect(page.locator(".aether")).toHaveAttribute("data-opaque", "true");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Reduce transparency", { exact: false }).uncheck();
  await page.getByRole("button", { name: "Light", exact: true }).click();
});
test("native tabs, workspace save, and real session restoration", async () => {
  // This is a test-only web page. No fixture data is included in production.
  await context.route("https://aether-fixture.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Integration research</title><h1>Test page</h1>",
    }),
  );
  const web = await context.newPage();
  await web.goto("https://aether-fixture.test/research");
  await page.bringToFront();
  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Research");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Research", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tabs", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search titles and URLs" })
    .fill("Integration research");
  await expect(
    page.getByRole("button", { name: /Integration research/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pin Integration research", exact: true })
    .click();
  await expect
    .poll(() => web.evaluate(() => document.title))
    .toBe("Integration research");
  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  const before = context.pages().length;
  await page
    .locator(".collection-card")
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("button", { name: "Open selected tabs" }).click();
  await expect.poll(() => context.pages().length).toBeGreaterThan(before);
});
test("notes persist and command search supports the keyboard", async () => {
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "New note" }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Remember this");
  await page
    .getByRole("textbox", { name: "Note", exact: true })
    .fill("Local and private.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("heading", { name: "Remember this" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    page.getByText("Local and private.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Search commands and tabs" })
    .fill("Appearance");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "A little more you." }),
  ).toBeVisible();
});
test("four surfaces, narrow layouts, reduced motion, and accessibility", async () => {
  for (const surface of ["newtab", "popup", "sidepanel", "app"]) {
    const view = await context.newPage();
    view.on("pageerror", (e) => errors.push(e.message));
    await view.setViewportSize(
      surface === "popup" || surface === "sidepanel"
        ? { width: 400, height: 700 }
        : { width: 1440, height: 1000 },
    );
    await view.goto(`${origin}/${surface}.html`);
    await expect(view.locator(".aether")).toBeVisible();
    await expect(view.getByText("Getting your space ready…")).toHaveCount(0);
    const overflow = await view.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await view.emulateMedia({ reducedMotion: "reduce" });
    const results = await new AxeBuilder({ page: view })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await view.close();
  }
  expect(errors).toEqual([]);
});
