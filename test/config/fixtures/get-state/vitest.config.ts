import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    isolate: false,
    maxWorkers: 1,
  }
})
