import assert from 'node:assert';
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [{
    name: "coverage-options-by-runtime-plugin",
    configureVitest(context) {
      const coverage = context.vitest.config.coverage
      assert(coverage.provider === "v8" || coverage.provider === "istanbul")

      coverage.include ||= []
      coverage.include.push("**/even.ts");
      coverage.include.push("**/untested-file.ts");

      coverage.exclude.push("**/math.ts");
    },
  }],
})
