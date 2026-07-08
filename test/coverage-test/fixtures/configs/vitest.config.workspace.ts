import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: [resolve(import.meta.dirname, "../../setup.native.ts")],

    projects: [
      {
        extends: true,
        test: {
          name: "project1",
          root: "./project1",
        },
      },
      {
        extends: true,
        test: {
          name: "project2",
          root: "./project2",
        },
      },
      {
        extends: true,
        test: {
          name: 'project-shared',
          root: './shared',
        }
      }
    ]
  }
});
