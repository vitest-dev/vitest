import { expect, test, describe } from 'vitest'
import { runVitest } from '../../test-utils'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'
import fs from 'node:fs'
import path from 'node:path'

describe('VITEST_WATCH Configuration File Integration', () => {
  describe('Configuration File Override', () => {
    test('environment variable should override config file watch setting', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'false' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'config-override-test')
          const testFile = path.join(testDir, 'simple.test.ts')
          const configFile = path.join(testDir, 'vitest.config.ts')

          fs.mkdirSync(testDir, { recursive: true })

          // Create config file with watch: true
          fs.writeFileSync(configFile, `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: true, // This should be overridden by VITEST_WATCH=false
  },
})
`)

          // Create simple test file
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

          // Environment variable should take precedence over config file
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('environment variable should override config file watch setting (reverse case)', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'true' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'config-override-reverse-test')
          const testFile = path.join(testDir, 'simple.test.ts')
          const configFile = path.join(testDir, 'vitest.config.ts')

          fs.mkdirSync(testDir, { recursive: true })

          // Create config file with watch: false
          fs.writeFileSync(configFile, `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false, // This should be overridden by VITEST_WATCH=true
  },
})
`)

          // Create simple test file
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

          // Environment variable should take precedence over config file
          expect(config.watch).toBe(true)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Multiple Configuration Sources', () => {
    test('CLI flag should take precedence over environment variable and config file', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'true' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'config-precedence-test')
          const testFile = path.join(testDir, 'simple.test.ts')
          const configFile = path.join(testDir, 'vitest.config.ts')

          fs.mkdirSync(testDir, { recursive: true })

          // Create config file with watch: true
          fs.writeFileSync(configFile, `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: true,
  },
})
`)

          // Create simple test file
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { ctx } = await runVitest({
            root: testDir,
            // CLI flag should take precedence over both env var and config
            watch: false,
          })

          const project = ctx!.projects[0]
          const config = project.config

          // CLI flag should take precedence over environment variable and config file
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Configuration File Without Environment Variable', () => {
    test('config file should work normally when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'config-normal-test')
          const testFile = path.join(testDir, 'simple.test.ts')
          const configFile = path.join(testDir, 'vitest.config.ts')

          fs.mkdirSync(testDir, { recursive: true })

          // Create config file with watch: false
          fs.writeFileSync(configFile, `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
  },
})
`)

          // Create simple test file
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

          // Config file should work as expected when no environment variable is set
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
