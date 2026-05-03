import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    snapshotSerializers: ['./serializer-1.js', './serializer-2.ts']
  }
})
