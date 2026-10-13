import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { startAether } from "./support";
let context: BrowserContext, page: Page, close: () => Promise<void>;
test.beforeAll(async () => {
  ({ context, page, close } = await startAether());
});
test.afterAll(async () => close?.());

test("daily priorities persist, share Notes data, and support complete/reopen", async () => {
  await page.getByLabel("New daily priority").fill("Ship a thoughtful upgrade");
  await page.getByRole("button", { name: "Add daily priority" }).click();
  await expect(
    page
      .locator(".priority-list")
      .getByText("Ship a thoughtful upgrade", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Complete priority Ship a thoughtful upgrade",
    })
    .click();
  await expect(
    page.getByText("1 of 1 complete", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reopen priority Ship a thoughtful upgrade" })
    .click();
  await expect(
    page.getByText("0 of 1 complete", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage priorities in Notes" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Ship a thoughtful upgrade",
      exact: true,
    }),
  ).toBeVisible();
});

test("focus presets persist, immersive view dismisses, and native timer survives reload", async () => {
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await page
    .getByRole("group", { name: "Focus duration presets" })
    .getByRole("button", { name: "45 minutes", exact: true })
    .click();
  await expect(page.locator(".timer-face")).toContainText("45:00");
  await page.reload();
  await expect(page.locator(".timer-face")).toContainText("45:00");
  await page
    .getByRole("button", { name: "Immersive view", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "What are you working on?" })
    .fill("Finish the release");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Begin focus", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Finish the release", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Stop session", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop session", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Begin focus", exact: true }),
  ).toBeVisible();
});

test("analytics ranges and new motion/goal preferences work without recording fabricated data", async () => {
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  for (const range of [30, 90, 7]) {
    const button = page
      .getByRole("group", { name: "Analytics date range" })
      .getByRole("button", { name: `${range} days`, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Export CSV", exact: true }),
    ).toBeDisabled();
  }
  await expect(page.locator(".heatmap > .heat-cell")).toHaveCount(91);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Reduce motion", { exact: false }).check();
  await page.getByLabel("Daily focus goal", { exact: true }).selectOption("60");
  await page.reload();
  await expect(page.locator(".aether")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(
    page.getByText("of your 60-minute daily goal", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("new dashboard stays usable on narrow new-tab and popup surfaces", async () => {
  for (const surface of ["newtab", "popup"]) {
    const view = await context.newPage();
    await view.setViewportSize({
      width: surface === "popup" ? 400 : 360,
      height: 800,
    });
    await view.goto(page.url().replace("app.html", `${surface}.html`));
    if (surface === "popup") {
      await view.evaluate(async () => {
        const stored = await chrome.storage.local.get("config");
        await chrome.storage.local.set({
          config: {
            ...stored.config,
            surfaceViews: { ...stored.config.surfaceViews, popup: "dashboard" },
          },
        });
      });
      await view.reload();
    }
    await expect(view.getByLabel("New daily priority")).toBeVisible();
    expect(
      await view.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page: view })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await view.close();
  }
});

test("recorded data drives range totals, website shares, heatmap and downloaded CSV", async () => {
  // Synthetic records are confined to this isolated test profile.
  await page.evaluate(async () => {
    const day = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("aether");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("activity", "readwrite");
        const store = transaction.objectStore("activity");
        store.clear();
        for (const row of [
          {
            id: "test-today",
            day: day(0),
            domain: "research.test",
            seconds: 600,
          },
          {
            id: "test-yesterday",
            day: day(1),
            domain: "research.test",
            seconds: 1200,
          },
          {
            id: "test-older",
            day: day(20),
            domain: "reading.test",
            seconds: 3600,
          },
        ])
          store.put(row);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.locator(".insight-metrics .metric").first()).toHaveText(
    "30m",
  );
  await expect(page.getByText("30m · 100%", { exact: true })).toBeVisible();
  await expect(
    page.locator('.heatmap > .heat-cell:not([data-level="0"])'),
  ).toHaveCount(3);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("aether-activity-7d.csv");
  const contents = await readFile((await file.path())!, "utf8");
  expect(contents).toContain('"research.test",600');
  expect(contents).toContain('"research.test",1200');
  expect(contents).not.toContain("reading.test");
  await page
    .getByRole("group", { name: "Analytics date range" })
    .getByRole("button", { name: "30 days", exact: true })
    .click();
  await expect(page.locator(".insight-metrics .metric").first()).toHaveText(
    "1.5h",
  );
  await expect(page.locator(".domain-usage").first()).toContainText("reading.test");
});
