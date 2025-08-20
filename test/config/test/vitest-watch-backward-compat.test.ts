import { expect, test, describe } from 'vitest'
import { runVitest } from '../../test-utils'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'
import fs from 'node:fs'
import path from 'node:path'

describe('VITEST_WATCH Backward Compatibility', () => {
  describe('Existing Behavior Preservation', () => {
    test('existing behavior should be preserved when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'backward-compat-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // Should behave exactly as before - watch should be true for interactive terminal
          expect(config.watch).toBe(true)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('existing CLI flags should work as expected', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'backward-cli-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
            watch: false, // Explicit CLI flag
          })

          const project = ctx!.projects[0]
          const config = project.config

          // CLI flag should work as before
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('CI environment should still disable watch mode', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(true)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'backward-ci-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // CI should still disable watch mode as before
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('non-TTY environment should still disable watch mode', async () => {
      const restoreTTY = mockTTY(false)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'backward-tty-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // Non-TTY should still disable watch mode as before
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Migration Path', () => {
    test('projects can gradually adopt the environment variable', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        // Test without environment variable (existing behavior)
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'migration-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // Should work as before
          expect(config.watch).toBe(true)

          fs.rmSync(testDir, { recursive: true, force: true })
        })

        // Test with environment variable (new behavior)
        await withEnv({ VITEST_WATCH: 'false' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'migration-test-2')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // Should use new environment variable behavior
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('no required changes to existing setups', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'no-changes-test')
          const testFile = path.join(testDir, 'simple.test.ts')
          const configFile = path.join(testDir, 'vitest.config.ts')

          fs.mkdirSync(testDir, { recursive: true })

          // Create a typical existing setup
          fs.writeFileSync(configFile, `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
  },
})
`)

          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // Existing setup should work exactly as before
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })
})
