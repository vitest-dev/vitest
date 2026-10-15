import type { CoverageMap } from 'istanbul-lib-coverage'
import { createCoverageSummary } from 'istanbul-lib-coverage'
import { parseModule } from 'magicast'

import { expect, test, vi } from 'vitest'
import { defineConfig } from 'vitest/config'
import { BaseCoverageProvider } from 'vitest/node'

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

test('formats values with custom formatter', async () => {
  const config = parseModule(`export default ${initialConfig}`)

  const autoUpdate = vi.fn().mockImplementation(value => value + 10_000)
  const updatedConfig = await updateThresholds(config, { thresholds: { autoUpdate } })

  expect(updatedConfig).toMatchInlineSnapshot(`
    "export default {
      "test": {
        "coverage": {
          "thresholds": {
            "lines": 10050,
            "branches": 10060,
            "functions": 10070,
            "statements": 10080
          }
        }
      }
    }"
  `)

  const calls = autoUpdate.mock.calls.flatMap(call => call[0])

  expect(calls.sort()).toEqual([50, 60, 70, 80])
})

test('per-file autoUpdate uses the lowest file and skips globs with no matched files', async () => {
  const config = parseModule(`export default ${JSON.stringify(defineConfig({
    test: {
      coverage: {
        thresholds: {
          '**/src/*.ts': { lines: 1 },
          '**/empty/*.ts': { lines: 1 },
        },
      },
    },
  }), null, 2)}`)

  const summaryData = { total: 0, covered: 0, skipped: 0 }
  const summaryFor = (pct: number) => createCoverageSummary({
    lines: { pct, ...summaryData },
    statements: { pct, ...summaryData },
    branches: { pct, ...summaryData },
    functions: { pct, ...summaryData },
  })

  const thresholds = [
    {
      name: '**/src/*.ts',
      thresholds: { lines: 1, branches: 1, functions: 1, statements: 1 },
      perFile: true,
      perFileThresholds: null,
      coverageMap: {
        files: () => ['a.ts', 'b.ts'],
        fileCoverageFor: (file: string) => ({
          toSummary: () => summaryFor(file === 'a.ts' ? 80 : 30),
        }),
      } as unknown as CoverageMap,
    },
    {
      name: '**/empty/*.ts',
      thresholds: { lines: 1, branches: 1, functions: 1, statements: 1 },
      perFile: true,
      perFileThresholds: null,
      coverageMap: {
        files: () => [],
      } as unknown as CoverageMap,
    },
  ]

  const updated = await new Promise<string>((resolve, reject) => {
    const provider = new BaseCoverageProvider()

    provider._initialize({
      config: { coverage: {} },
      logger: { log: () => {} },
      _coverageOptions: {},
    } as any)

    provider.updateThresholds({
      thresholds,
      configurationFile: config,
      onUpdate: () => resolve(config.generate().code),
    }).catch(error => reject(error))
  })

  expect(updated).toMatchInlineSnapshot(`
    "export default {
      "test": {
        "coverage": {
          "thresholds": {
            "**/src/*.ts": {
              "lines": 30,
              functions: 30,
              statements: 30,
              branches: 30
            },
            "**/empty/*.ts": {
              "lines": 1
            }
          }
        }
      }
    }"
  `)
})

test('passes previous threshold as second argument to custom formatter', async () => {
  const config = parseModule(`export default ${initialConfig}`)

  const autoUpdate = vi.fn().mockImplementation(value => value)
  await updateThresholds(config, { thresholds: { autoUpdate } })

  const previousValues = autoUpdate.mock.calls.map(call => [call[0], call[1]])

  expect(previousValues.sort((a, b) => a[0] - b[0])).toEqual([
    [coveredThresholds.lines, initialThresholds.lines],
    [coveredThresholds.branches, initialThresholds.branches],
    [coveredThresholds.functions, initialThresholds.functions],
    [coveredThresholds.statements, initialThresholds.statements],
  ].sort((a, b) => a[0] - b[0]))
})

async function updateThresholds(configurationFile: ReturnType<typeof parseModule>, _coverageOptions: Partial<(InstanceType<typeof BaseCoverageProvider>)['options']> = {}) {
  const summaryData = { total: 0, covered: 0, skipped: 0 }
  const thresholds = [{
    name: 'global',
    thresholds: initialThresholds,
    perFile: false,
    perFileThresholds: null,
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
      _coverageOptions,
    } as any)

    provider.updateThresholds({
      thresholds,
      configurationFile,
      onUpdate: () => resolve(configurationFile.generate().code),
    }).catch(error => reject(error))
  })
}
