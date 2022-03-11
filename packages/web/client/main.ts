import { createClient } from "@vitest/ws-client";

// @ts-ignore
globalThis.process = { env: {}, argv: [], stdout: { write: () => {} } };

export const PORT = import.meta.hot ? "51204" : location.port;
export const HOST = [location.hostname, PORT].filter(Boolean).join(":");
export const ENTRY_URL = `${
  location.protocol === "https:" ? "wss:" : "ws:"
}//${HOST}/__vitest_api__`;

export const client = createClient(ENTRY_URL, {
  handlers: {
    async onPathsCollected(paths) {
      if (!paths) {
        return;
      }
      const config = globalThis.__vitest_worker__.config;

      const { startTests, setupGlobalEnv } = (await import(
        "vitest"
      )) as unknown as typeof import("vitest/dist/web");

      await setupGlobalEnv(config);

      await startTests(paths, config);

      await client.rpc.onFinished();
      await client.rpc.onWatcherStart();
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
  globalThis.process = { env: {}, argv: [], stdout: { write: () => {} } };

  // @ts-ignore
  globalThis.global = globalThis;
  // @ts-ignore
  globalThis.__vitest_mocker__ = {};
  const files = await client.rpc.getPaths();

  const { startTests, setupGlobalEnv } = (await import(
    /* @vite-ignore */ "vitest"
  )) as unknown as typeof import("vitest/dist/web");

  await setupGlobalEnv(config);

  await startTests(files, config);

  await client.rpc.onFinished();
  await client.rpc.onWatcherStart();
});
