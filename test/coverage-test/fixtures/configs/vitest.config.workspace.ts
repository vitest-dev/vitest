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
          root: "fixtures/workspaces/project/project1",
        },
      },
      {
        extends: true,
        test: {
          name: "project2",
          root: "fixtures/workspaces/project/project2",
        },
      },
      {
        extends: true,
        test: {
          name: 'project-shared',
          root: 'fixtures/workspaces/project/shared',
        }
      }
    ]
  }
});
