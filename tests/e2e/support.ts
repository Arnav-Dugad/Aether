import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
export async function startAether(): Promise<{
  context: BrowserContext;
  page: Page;
  origin: string;
  close: () => Promise<void>;
}> {
  const profile = await mkdtemp(`${tmpdir()}/aether-next-`);
  const extension = resolve(".output/chrome-mv3");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const origin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const page = await context.newPage();
  await page.goto(`${origin}/app.html`);
  await page.getByRole("button", { name: "Make yourself at home" }).click();
  await context.route("https://aether-fixture.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<title>Aether fixture ${new URL(route.request().url()).pathname.slice(1)}</title><h1>Browser integration fixture</h1>`,
    }),
  );
  return {
    context,
    page,
    origin,
    close: async () => {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}
export async function fixtureTab(
  context: BrowserContext,
  name: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`https://aether-fixture.test/${name}`);
  return page;
}
