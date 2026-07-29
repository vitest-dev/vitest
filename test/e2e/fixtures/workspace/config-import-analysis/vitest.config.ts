import { defineConfig } from 'vitest/config'
import depAsJs from "./dep.js"

export default defineConfig({
  test: {
    projects: [
      "./packages/*",
      ...depAsJs,
    ],
  }
})