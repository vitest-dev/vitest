import { createClient, getTasks } from "@vitest/ws-client";

// @ts-ignore
globalThis.process = { env: {}, argv: [] };

export const PORT = import.meta.hot ? "3000" : location.port;
export const HOST = [location.hostname, PORT].filter(Boolean).join(":");
export const ENTRY_URL = `${
  location.protocol === "https:" ? "wss:" : "ws:"
}//${HOST}/__vitest_api__`;

export const client = createClient(ENTRY_URL, {
  handlers: {
    async onCollected(files) {
      if (!files) {
        return
      }
      const config = globalThis.__vitest_worker__.config;

      const { startTests, setupGlobalEnv } = (await import(
        "vitest"
      )) as unknown as typeof import("vitest/dist/web");

      await setupGlobalEnv(config);

      await startTests(
        files.map((f) => f.filepath),
        config
      );

      await client.rpc.onFinished()
      await client.rpc.onWatcherStart()
    },
  },
});

const ws = client.ws;

ws.addEventListener("open", async () => {
  const config = await client.rpc.getConfig();

  // @ts-ignore
  globalThis.__vitest_worker__ = {
    config,
    rpc: client.rpc,
  };
  // @ts-ignore
  globalThis.process = { env: {}, argv: [] };

  // @ts-ignore
  globalThis.global = globalThis;
  // @ts-ignore
  globalThis.__vitest_mocker__ = {};
  const files = await client.rpc.getFiles();

  const { startTests, setupGlobalEnv } = (await import(
    "vitest"
  )) as unknown as typeof import("vitest/dist/web");

  await setupGlobalEnv(config);

  await startTests(
    files.map((f) => f.filepath),
    config
  );

  await client.rpc.onFinished()
  await client.rpc.onWatcherStart()
});
