import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
it("serializes concurrent appearance changes without losing either preference", async () => {
  let saved: Record<string, unknown> = {};
  vi.stubGlobal("chrome", {
    runtime: {
      id: "aether-test",
      sendMessage: async (message: { patch: Record<string, unknown> }) => {
        const { configSchema, mergeConfig } = await import(
          "../../src/lib/model"
        );
        saved = mergeConfig(configSchema.parse(saved), message.patch);
        return { ok: true, config: saved };
      },
    },
    storage: {
      local: {
        get: async () => ({ config: structuredClone(saved) }),
        set: async (data: { config: Record<string, unknown> }) => {
          await Promise.resolve();
          saved = structuredClone(data.config);
        },
      },
    },
  });
  const { patchStoredConfig, getConfig } = await import(
    "../../src/lib/browser"
  );
  await Promise.all([
    patchStoredConfig({ theme: "obsidian" }),
    patchStoredConfig({ reducedTransparency: true }),
  ]);
  expect((await getConfig()).theme).toBe("obsidian");
  expect((await getConfig()).reducedTransparency).toBe(true);
});
