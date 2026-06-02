import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    name: {
      label: "Example project",
      color: "magenta",
    },
    env: {
      CI: '1',
      FORCE_COLOR: '1',
      NO_COLOR: undefined,
      GITHUB_ACTIONS: undefined,
    },
  },
});
