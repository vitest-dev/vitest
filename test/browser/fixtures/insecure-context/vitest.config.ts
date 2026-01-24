import { fileURLToPath } from "node:url";
import os from "node:os";
import { defineConfig } from "vitest/config";
import { instances, provider } from "../../settings";

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider,
      instances,
    },
  },
  server: {
    host: os.hostname(), // To force an insecure-context, a host which is not 127.0.0.1 or localhost is needed
  },
});
