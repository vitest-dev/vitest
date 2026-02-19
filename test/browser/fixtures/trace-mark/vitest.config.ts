import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { instances, providers } from "../../settings";

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider: providers.playwright(),
      instances,
    },
  },
});
