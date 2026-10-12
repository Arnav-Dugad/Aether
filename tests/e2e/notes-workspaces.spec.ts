import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { startAether, fixtureTab } from "./support";
let context: BrowserContext, page: Page, close: () => Promise<void>;
test.beforeAll(async () => {
  ({ context, page, close } = await startAether());
  await fixtureTab(context, "One");
  await fixtureTab(context, "Two");
  await page.bringToFront();
});
test.afterAll(async () => close?.());
test("workspace editing, active ownership, archive, template, and selective restore", async () => {
  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Study");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Study", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Study", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Deep work");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Verified pages for a task");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Assign current window", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Filter workspace" }),
  ).toHaveValue(/.+/);
  await expect(page.locator(".tab-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  const card = page.locator(".collection-card");
  await card.getByRole("button", { name: "Open", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const checkboxes = dialog.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(2);
  await checkboxes.first().uncheck();
  await expect(checkboxes).toHaveCount(2);
  await checkboxes.first().check();
  await dialog
    .getByRole("button", { name: "Select none", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Open selected tabs" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("group", { name: "Workspace filter" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deep work", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unarchive", exact: true }).click();
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deep work template", exact: true }),
  ).toBeVisible();
});
test("autosave commits before navigation, flushes on Escape, and deletion does not resurrect", async () => {
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Autosaved");
  await page
    .getByRole("textbox", { name: "Note", exact: true })
    .fill("**Keep** this context.");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Autosaved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Note", exact: true })
    .fill("Last edit before closing.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Last edit before closing.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Note", exact: true })
    .fill("Do not resurrect");
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Autosaved", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Autosaved", exact: true }),
  ).toHaveCount(0);
});
test("serialized preferences from separate surfaces preserve both changes", async () => {
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.locator(".aether")).toBeVisible();
  const results = await Promise.all([
    page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "PATCH_CONFIG",
        patch: { theme: "graphite", surfaceViews: { app: "notes" } },
      }),
    ),
    other.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "PATCH_CONFIG",
        patch: { compact: true, surfaceViews: { popup: "workspaces" } },
      }),
    ),
  ]);
  expect(results.every((r) => r.ok)).toBe(true);
  const config = await page.evaluate(
    async () => (await chrome.storage.local.get("config")).config,
  );
  expect(config.theme).toBe("graphite");
  expect(config.compact).toBe(true);
  expect(config.surfaceViews.app).toBe("notes");
  expect(config.surfaceViews.popup).toBe("workspaces");
  await other.close();
});
