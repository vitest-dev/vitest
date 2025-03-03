import { defineConfig } from "vitest/config"
import linkedTs from "@vitest/test-dep-linked/ts";

export default defineConfig({
  plugins: [
    {
      name: "test-linked-ts",
      api: { linkedTs },
    }
  ]
})
