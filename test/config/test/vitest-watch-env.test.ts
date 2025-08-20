import { expect, test, describe } from 'vitest'
import { runVitest } from '../../test-utils'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'
import fs from 'node:fs'
import path from 'node:path'

describe('VITEST_WATCH Environment Variable', () => {
  describe('Environment Variable Parsing', () => {
    test.each([
      { value: 'true', expected: true, description: 'VITEST_WATCH=true' },
      { value: 'false', expected: false, description: 'VITEST_WATCH=false' },
      { value: '1', expected: true, description: 'VITEST_WATCH=1' },
      { value: '0', expected: false, description: 'VITEST_WATCH=0' },
      { value: 'yes', expected: true, description: 'VITEST_WATCH=yes' },
      { value: 'no', expected: false, description: 'VITEST_WATCH=no' },
      { value: 'TRUE', expected: true, description: 'VITEST_WATCH=TRUE (uppercase)' },
      { value: 'FALSE', expected: false, description: 'VITEST_WATCH=FALSE (uppercase)' },
      { value: 'invalid', expected: false, description: 'VITEST_WATCH=invalid' },
      { value: '', expected: false, description: 'VITEST_WATCH= (empty)' },
    ])('$description should resolve to $expected', async ({ value, expected }) => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: value }, async () => {
          // Create a simple test fixture
          const testDir = path.join(__dirname, 'fixtures', 'simple-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          // Ensure directory exists
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

          expect(config.watch).toBe(expected)

          // Cleanup
          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Default Behavior (No Environment Variable)', () => {
    test('should use default detection when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'default-test')
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

          // Should be true because !isCI && isTTY = !false && true = true
          expect(config.watch).toBe(true)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('should respect CI environment when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(true)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'ci-test')
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

          // Should be false because !isCI && isTTY = !true && true = false
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('should respect TTY when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(false)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'tty-test')
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

          // Should be false because !isCI && isTTY = !false && false = false
          expect(config.watch).toBe(false)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Environment Variable Precedence', () => {
    test('VITEST_WATCH=true should override CI=true', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(true)

      try {
        await withEnv({ VITEST_WATCH: 'true' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'precedence-test')
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

          // Should be true because VITEST_WATCH takes precedence over CI
          expect(config.watch).toBe(true)

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('VITEST_WATCH=false should override default detection', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'false' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'override-test')
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

          // Should be false because VITEST_WATCH takes precedence over default detection
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
