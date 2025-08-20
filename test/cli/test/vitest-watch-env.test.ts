import { expect, test, describe } from 'vitest'
import { runVitestCli } from '../../test-utils'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'
import fs from 'node:fs'
import path from 'node:path'

describe('VITEST_WATCH CLI Integration', () => {
  describe('CLI Command Behavior', () => {
    test('vitest with VITEST_WATCH=false should run tests and exit', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'false' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'cli-run-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { stdout, stderr } = await runVitestCli('run', testDir)

          // Should show RUN mode
          expect(stdout).toContain('RUN')
          expect(stdout).not.toContain('DEV')
          expect(stdout).not.toContain('Waiting for file changes')
          expect(stderr).toBe('')

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('vitest with VITEST_WATCH=true should run tests and enter watch mode', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'true' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'cli-watch-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { stdout, stderr } = await runVitestCli('watch', testDir)

          // Should show DEV mode and watch message
          expect(stdout).toContain('DEV')
          expect(stdout).toContain('Waiting for file changes')
          expect(stdout).not.toContain('RUN')
          expect(stderr).toBe('')

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })

    test('CLI flags should take precedence over environment variable', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: 'true' }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'cli-precedence-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          // Use --run flag which should override VITEST_WATCH=true
          const { stdout, stderr } = await runVitestCli('run', testDir)

          // Should show RUN mode despite VITEST_WATCH=true
          expect(stdout).toContain('RUN')
          expect(stdout).not.toContain('DEV')
          expect(stdout).not.toContain('Waiting for file changes')
          expect(stderr).toBe('')

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })

  describe('Default Behavior Verification', () => {
    test('default behavior should work when VITEST_WATCH is not set', async () => {
      const restoreTTY = mockTTY(true)
      const restoreCI = mockCI(false)

      try {
        await withEnv({ VITEST_WATCH: undefined }, async () => {
          const testDir = path.join(__dirname, 'fixtures', 'cli-default-test')
          const testFile = path.join(testDir, 'simple.test.ts')

          fs.mkdirSync(testDir, { recursive: true })
          fs.writeFileSync(testFile, `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`)

          const { stdout, stderr } = await runVitestCli('run', testDir)

          // Should work as expected with default behavior
          expect(stdout).toContain('RUN')
          expect(stderr).toBe('')

          fs.rmSync(testDir, { recursive: true, force: true })
        })
      } finally {
        restoreTTY()
        restoreCI()
      }
    })
  })
})
