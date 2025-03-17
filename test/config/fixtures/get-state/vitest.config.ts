import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    isolate: false,
    minWorkers: 1,
    maxWorkers: 1,
  }
})
