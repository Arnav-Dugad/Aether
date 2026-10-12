import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startAether, fixtureTab } from "./support";
let context: BrowserContext, page: Page, close: () => Promise<void>;
test.beforeAll(async () => {
  ({ context, page, close } = await startAether());
  for (const name of ["Alpha", "Beta", "Gamma"])
    await fixtureTab(context, name);
  await page.bringToFront();
  await page.getByRole("button", { name: "Tabs", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search titles and URLs" })
    .fill("Aether fixture");
  await expect(page.locator(".tab-row")).toHaveCount(3);
});
test.afterAll(async () => close?.());
const getTabs = () =>
  page.evaluate(async () =>
    (await chrome.tabs.query({})).filter((t) =>
      t.url?.startsWith("https://aether-fixture.test/"),
    ),
  );
test("bulk pin/undo, URL protection, guarded close, and close undo use actual browser tabs", async () => {
  await page
    .getByRole("checkbox", { name: "Select matching", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Pin selected tabs", exact: true })
    .click();
  await expect
    .poll(async () => (await getTabs()).filter((t) => t.pinned).length)
    .toBe(3);
  await page
    .getByRole("button", { name: "Undo pin 3 tabs", exact: true })
    .click();
  await expect
    .poll(async () => (await getTabs()).filter((t) => t.pinned).length)
    .toBe(0);
  await page
    .getByRole("button", { name: "Protect Aether fixture Alpha", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unprotect Aether fixture Alpha",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close selected tabs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close 2 reviewed tabs", exact: true })
    .click();
  await expect.poll(async () => (await getTabs()).length).toBe(1);
  expect((await getTabs())[0]?.title).toBe("Aether fixture Alpha");
  await page
    .getByRole("button", { name: "Undo close 2 tabs", exact: true })
    .click();
  await expect.poll(async () => (await getTabs()).length).toBe(3);
});
test("native grouping and move undo preserve tab identity and original group", async () => {
  await page
    .getByRole("checkbox", { name: "Select matching", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Group selected tabs", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Group name", exact: true })
    .fill("Fixture group");
  await page.getByRole("button", { name: "Group tabs", exact: true }).click();
  await expect
    .poll(async () => new Set((await getTabs()).map((t) => t.groupId)).size)
    .toBe(1);
  const before = (await getTabs()).find(
    (t) => t.title === "Aether fixture Beta",
  )!;
  expect(before.groupId).toBeGreaterThanOrEqual(0);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select Aether fixture Beta", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Move selected tabs", exact: true })
    .click();
  await page.getByRole("button", { name: "Move tabs", exact: true }).click();
  await expect
    .poll(
      async () => (await getTabs()).find((t) => t.id === before.id)?.windowId,
    )
    .not.toBe(before.windowId);
  await page
    .getByRole("button", { name: "Undo move 1 tabs", exact: true })
    .click();
  await expect
    .poll(async () => ({
      windowId: (await getTabs()).find((t) => t.id === before.id)?.windowId,
      result: await page.locator(".action-result").textContent(),
    }))
    .toEqual({ windowId: before.windowId, result: "1 changed" });
  await expect
    .poll(
      async () => (await getTabs()).find((t) => t.id === before.id)?.groupId,
    )
    .toBe(before.groupId);
});
test("labels, favorites, view settings, command index and narrow tab layouts persist", async () => {
  await page
    .getByRole("button", {
      name: "Edit label for Aether fixture Beta",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Custom tab label", exact: true })
    .fill("My research");
  await page.getByRole("button", { name: "Save label", exact: true }).click();
  await expect(page.getByText("My research", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Favorite My research", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Filter tabs", exact: true })
    .selectOption("favorites");
  await expect(page.locator(".tab-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Card view", exact: true }).click();
  await expect(page.locator(".tab-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Card view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Search commands and tabs" })
    .fill("t:myresearch");
  await expect(
    page.getByRole("option").filter({ hasText: "My research" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  for (const view of ["List view", "Card view", "Domain view", "Window view"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await page.setViewportSize({ width: 400, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});
