import type { CoverageMap } from 'istanbul-lib-coverage'
import { createCoverageSummary } from 'istanbul-lib-coverage'
import { parseModule } from 'magicast'

import { expect, test } from 'vitest'
import { defineConfig } from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/coverage'

const initialThresholds = { lines: 1, branches: 2, functions: 3, statements: 4 }
const coveredThresholds = { lines: 50, branches: 60, functions: 70, statements: 80 }
const initialConfig = JSON.stringify(defineConfig({
  test: {
    coverage: {
      thresholds: initialThresholds,
    },
  },
}), null, 2)

test('updates thresholds on "export default {..}"', async () => {
  const config = parseModule(`export default ${initialConfig}`)

  const updatedConfig = await updateThresholds(config)

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default {
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 50,
            "branches": 60,
            "functions": 70,
            "statements": 80
          }
        }
      }
    }"
  `)
})

test('updates thresholds on "export default defineConfig({...})"', async () => {
  const config = parseModule(`export default defineConfig(${initialConfig})`)

  const updatedConfig = await updateThresholds(config)

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default defineConfig({
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 50,
            "branches": 60,
            "functions": 70,
            "statements": 80
          }
        }
      }
    })"
  `)
})

test('updates thresholds on "export default defineConfig(() => ({...}))"', async () => {
  const config = parseModule(`export default defineConfig(() => (${initialConfig}))`)

  const updatedConfig = await updateThresholds(config)

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default defineConfig(() => ({
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 50,
            "branches": 60,
            "functions": 70,
            "statements": 80
          }
        }
      }
    }))"
  `)
})

test('updates thresholds on "export default mergeConfig({...}, defineConfig({...}))"', async () => {
  const config = parseModule(`export default mergeConfig(baseConfig, defineConfig(${initialConfig}))`)

  const updatedConfig = await updateThresholds(config)

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default mergeConfig(baseConfig, defineConfig({
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 50,
            "branches": 60,
            "functions": 70,
            "statements": 80
          }
        }
      }
    }))"
  `)
})

test('updates thresholds on "export default defineConfig(() => mergeConfig({...}, defineConfig({...})))"', async () => {
  const config = parseModule(`export default defineConfig((configEnv) => mergeConfig(baseConfig, defineConfig(${initialConfig})))`)

  const updatedConfig = await updateThresholds(config)

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default defineConfig((configEnv) => mergeConfig(baseConfig, defineConfig({
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 50,
            "branches": 60,
            "functions": 70,
            "statements": 80
          }
        }
      }
    })))"
  `)
})

test('throws when configuration is too complex to analyze', async () => {
  const config = parseModule(`
import config from "./some-path"
export default config
  `)

  await expect(updateThresholds(config)).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Failed to update coverage thresholds. Configuration file is too complex.]`)
})

async function updateThresholds(configurationFile: ReturnType<typeof parseModule>) {
  const summaryData = { total: 0, covered: 0, skipped: 0 }
  const thresholds = [{
    name: 'global',
    thresholds: initialThresholds,
    coverageMap: {
      getCoverageSummary: () => createCoverageSummary({
        lines: { pct: coveredThresholds.lines, ...summaryData },
        statements: { pct: coveredThresholds.statements, ...summaryData },
        branches: { pct: coveredThresholds.branches, ...summaryData },
        functions: { pct: coveredThresholds.functions, ...summaryData },
      }),
    } as CoverageMap,
  }]

  return new Promise((resolve, reject) => {
    const provider = new BaseCoverageProvider()

    provider._initialize({
      config: { coverage: { } },
      logger: { log: () => {} },
    } as any)

    provider.updateThresholds({
      thresholds,
      configurationFile,
      onUpdate: () => resolve(configurationFile.generate().code),
    }).catch(error => reject(error))
  })
}
