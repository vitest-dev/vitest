/// <reference types="vitest" />

import { defineConfig } from "vite"

export default defineConfig({
  test: {
    global: true,
    dom: "happy-dom",
  },
})
