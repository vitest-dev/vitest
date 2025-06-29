import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "project1",
          root: "fixtures/workspaces/project/project1",
        },
      },
      {
        test: {
          name: "project2",
          root: "fixtures/workspaces/project/project2",
        },
      },
      {
        test: {
          name: 'project-shared',
          root: 'fixtures/workspaces/project/shared',
        }
      }
    ]
  }
});
