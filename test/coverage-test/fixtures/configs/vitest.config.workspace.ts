import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
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
]);
