import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["project-a", "project-b"],
  },
});
