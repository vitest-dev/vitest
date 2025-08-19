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

test('autoUpdate function rounds down decimal coverage to whole numbers', async () => {
  // Create a config with autoUpdate function that rounds down to whole numbers
  const configWithFunction = JSON.stringify(defineConfig({
    test: {
      coverage: {
        thresholds: {
          autoUpdate: (value: number | undefined) => value ? Math.floor(value) : value,
          lines: 80, // Will be updated from 85.67 -> 85 (rounded down)
          functions: 75, // Will be updated from 78.34 -> 78 (rounded down)
          branches: 70, // Will be updated from 72.89 -> 72 (rounded down)
        },
      },
    },
  }), null, 2)

  const config = parseModule(`export default ${configWithFunction}`)

  // Use realistic coverage values with decimal places
  const summaryData = { total: 0, covered: 0, skipped: 0 }
  const thresholds = [{
    name: 'global',
    thresholds: { lines: 80, functions: 75, branches: 70 },
    coverageMap: {
      getCoverageSummary: () => createCoverageSummary({
        lines: { pct: 85.67, ...summaryData },
        functions: { pct: 78.34, ...summaryData },
        branches: { pct: 72.89, ...summaryData },
        statements: { pct: 65.12, ...summaryData },
      }),
    } as CoverageMap,
  }]

  const provider = new BaseCoverageProvider()
  provider._initialize({
    _coverageOptions: {
      thresholds: {
        autoUpdate: (value: number | undefined) => value ? Math.floor(value) : value,
      },
    },
    logger: { log: () => {} },
  } as any)

  let updatedConfig = ''
  await provider.updateThresholds({
    thresholds,
    configurationFile: config,
    onUpdate: () => { updatedConfig = config.generate().code },
  })

  // Verify the function rounded down the decimal values to whole numbers
  expect(updatedConfig).toContain('"lines": 85')
  expect(updatedConfig).toContain('"functions": 78')
  expect(updatedConfig).toContain('"branches": 72')

  // Verify decimal values aren't present in the config
  expect(updatedConfig).not.toContain('85.67')
  expect(updatedConfig).not.toContain('78.34')
  expect(updatedConfig).not.toContain('72.89')
})

async function updateThresholds(configurationFile: ReturnType<typeof parseModule>) {
  const summaryData = { total: 0, covered: 0, skipped: 0 }

  const configCode = configurationFile.generate().code
  let actualThresholds = initialThresholds

  if (configCode.includes('"lines": 30')) {
    actualThresholds = { lines: 30, branches: 50, functions: 30, statements: 30 }
  }

  const thresholds = [{
    name: 'global',
    thresholds: actualThresholds,
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
      config: { coverage: { thresholds: { autoUpdate: true } } },
      logger: { log: () => {} },
      _coverageOptions: { thresholds: { autoUpdate: true } },
    } as any)

    provider.updateThresholds({
      thresholds,
      configurationFile,
      onUpdate: () => resolve(configurationFile.generate().code),
    }).catch(error => reject(error))
  })
}
