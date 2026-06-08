import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: ["@test/test-dep-url"],
  },
  ssr: {
    noExternal: ["test-dep-simple"],
    optimizeDeps: {
      include: ["@test/test-dep-url"],
    },
  },
  test: {
    deps: {
      optimizer: {
        client: {
          enabled: true,
        },
        ssr: {
          enabled: true,
        },
      },
    },
  },
});
