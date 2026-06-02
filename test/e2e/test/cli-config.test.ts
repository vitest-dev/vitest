import { resolve } from 'pathe'
import { expect, it, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runVitest, useFS } from '../../test-utils'

test('can pass down the config as a module', async () => {
  const vitest = await createVitest('test', {
    config: '@test/test-dep-config',
  })

  expect(vitest.vite.config.configFile).toBe(
    resolve(import.meta.dirname, '../deps/test-dep-config/index.js'),
  )
})

it('correctly inherit from the cli', async () => {
  const { ctx } = await runVitest({
    $cliOptions: {
      root: 'fixtures/workspace-flags',
      logHeapUsage: true,
      allowOnly: true,
      sequence: {
        seed: 123,
      },
      testTimeout: 5321,
      pool: 'forks',
      globals: true,
      expandSnapshotDiff: true,
      retry: 6,
      testNamePattern: 'math',
      passWithNoTests: true,
      bail: 100,
      experimental: {
        importDurations: {
          print: true,
        },
      },
    },
  })
  const project = ctx!.projects[0]
  const config = project.config
  expect(config).toMatchObject({
    logHeapUsage: true,
    allowOnly: true,
    sequence: expect.objectContaining({
      seed: 123,
    }),
    testTimeout: 5321,
    pool: 'forks',
    globals: true,
    expandSnapshotDiff: true,
    retry: 6,
    passWithNoTests: true,
    bail: 100,
    experimental: {
      importDurations: {
        print: true,
        limit: 10,
      },
    },
  })
  expect(config.testNamePattern?.test('math')).toBe(true)
})

it('fails when resolved root directory does not exist', async () => {
  const parent = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(parent, {
    'vitest.config.ts': `
      throw new Error("parent config file should not be loaded")
    `,
  })
  const root = resolve(parent, 'missing-dir')
  const result = await runVitest({ root }, undefined, { fails: true })
  expect(result.stderr).toContain('Error: Root path does not exist or is not a directory')
  expect(result.stderr).not.toContain('parent config file should not be loaded')
  expect(result.thrown).toBe(true)
})

it('does not lookup config from parent directory', async () => {
  const parent = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(parent, {
    'vitest.config.ts': `
      throw new Error("parent config file should not be loaded")
    `,
    'good-dir/basic.test.ts': `
      test('ok', () => {})
    `,
  })
  const root = resolve(parent, 'good-dir')
  const result = await runVitest({ root, globals: true })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "ok": "passed",
      },
    }
  `)
})

it('loads explicit config from parent directory', async () => {
  const parent = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(parent, {
    'vitest.config.ts': `
      export default {
        test: {
          globals: true,
        },
      }
    `,
    'dir1/file1.test.ts': `
      test('ok', () => {})
    `,
    'dir2/file2.test.ts': `
      test('ok', () => {})
    `,
  })
  const result = await runVitest({
    root: resolve(parent, 'dir1'),
    config: resolve(parent, 'vitest.config.ts'),
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "file1.test.ts": {
        "ok": "passed",
      },
    }
  `)
})
