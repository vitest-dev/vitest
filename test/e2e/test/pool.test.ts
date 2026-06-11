import type { SerializedConfig } from 'vitest'
import type { TestUserConfig } from 'vitest/node'
import { normalize } from 'pathe'
import { assert, describe, expect, test, vi } from 'vitest'
import { runInlineTests, runVitest, StableTestFileOrderSorter } from '../../test-utils'

describe.each(['forks', 'threads', 'vmThreads', 'vmForks'])('%s', async (pool) => {
  test('resolves top-level pool', async () => {
    const config = await getConfig({ pool })

    expect(config.pool).toBe(pool)
  })

  test('can capture worker\'s stdout and stderr', async () => {
    const { stdout, stderr } = await runVitest({
      root: './fixtures/pool',
      include: ['write-to-stdout-and-stderr.test.ts'],
      pool,
    })

    expect(stderr).toContain('Worker writing to stderr')
    expect(stdout).toContain('Worker writing to stdout')
    expect(stderr).toContain('MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 3 message listeners added to [TestFixturesCustomEmitter]')
  })
})

test('extended project inherits top-level pool related options', async () => {
  const config = await getConfig({
    projects: [{
      extends: true,
      test: { name: 'example' },
    }],
  },
  // project.extends works weirdly with runVitest(). Need to pass it here in cli options instead.
  { pool: 'threads', isolate: false })

  expect(config.pool).toBe('threads')
  expect(config.isolate).toBe(false)
})

test('project level pool options overwrites top-level', async () => {
  const config = await getConfig({
    pool: 'vmForks',
    maxWorkers: 4,
    fileParallelism: true,
    projects: [{
      extends: true,
      test: { pool: 'vmThreads', fileParallelism: false },
    }],
  })

  expect(config.pool).toBe('vmThreads')
  expect(config.maxWorkers).toBe(1)
})

test('serialized config includes slowTestThreshold', async () => {
  const config = await getConfig({})

  expect(config.slowTestThreshold).toBe(300)
})

test('isolated single worker pool receives single testfile at once', async () => {
  const files = await getConfig<string[]>({
    maxWorkers: 1,
    isolate: true,
    sequence: { sequencer: StableTestFileOrderSorter },
  }, { include: ['print-testfiles.test.ts', 'a.test.ts', 'b.test.ts', 'c.test.ts'] })

  expect(files.map(normalizeFilename)).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/pool/print-testfiles.test.ts",
    ]
  `)
})

test('non-isolated single worker pool receives all testfiles at once', async () => {
  const files = await getConfig<string[]>({
    maxWorkers: 1,
    isolate: false,
    sequence: { sequencer: StableTestFileOrderSorter },
  }, { include: ['print-testfiles.test.ts', 'a.test.ts', 'b.test.ts', 'c.test.ts'] })

  expect(files.map(normalizeFilename)).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/pool/a.test.ts",
      "<process-cwd>/fixtures/pool/b.test.ts",
      "<process-cwd>/fixtures/pool/c.test.ts",
      "<process-cwd>/fixtures/pool/print-testfiles.test.ts",
    ]
  `)
})

test('non-isolated single worker pool collects in-source tests after importing the same files', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      '0-import-source.test.ts': `
        import { add } from './source-with-test'
        import { multiply } from './source-importing-source'
        import { expect, test } from 'vitest'

        test('imports source files', () => {
          expect(add(1, 2)).toBe(3)
          expect(multiply(2, 3)).toBe(6)
        })
      `,
      'source-with-test.ts': `
        export function add(a: number, b: number) {
          return a + b
        }

        if (import.meta.vitest) {
          const { expect, test } = import.meta.vitest

          test('add in source', () => {
            expect(add(2, 3)).toBe(5)
          })
        }
      `,
      'source-importing-source.ts': `
        import { add } from './source-with-test'

        export function multiply(a: number, b: number) {
          return Array.from({ length: b }).reduce<number>((total) => add(total, a), 0)
        }

        if (import.meta.vitest) {
          const { expect, test } = import.meta.vitest

          test('multiply in source', () => {
            expect(multiply(2, 4)).toBe(8)
          })
        }
      `,
    },
    {
      include: ['0-import-source.test.ts'],
      includeSource: ['source-*.ts'],
      isolate: false,
      maxWorkers: 1,
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "0-import-source.test.ts": {
        "imports source files": "passed",
      },
      "source-importing-source.ts": {
        "multiply in source": "passed",
      },
      "source-with-test.ts": {
        "add in source": "passed",
      },
    }
  `)
})

test('non-isolated happy-dom worker pool receives all testfiles at once', async () => {
  const files = await getConfig<string[]>({
    fileParallelism: false,
    isolate: false,
    environment: 'happy-dom',
    sequence: { sequencer: StableTestFileOrderSorter },
  }, { include: ['print-testfiles.test.ts', 'a.test.ts', 'b.test.ts', 'c.test.ts'] })

  expect(files.map(normalizeFilename)).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/pool/a.test.ts",
      "<process-cwd>/fixtures/pool/b.test.ts",
      "<process-cwd>/fixtures/pool/c.test.ts",
      "<process-cwd>/fixtures/pool/print-testfiles.test.ts",
    ]
  `)
})

test('worker start failure should not hang', async () => {
  const stop = vi.fn()

  const { stdout, stderr } = await runVitest({
    root: './fixtures/pool',
    include: ['a.test.ts'],
    pool: {
      name: 'pool-with-crashing-workers',
      // @ts-expect-error -- intentional
      createPoolWorker: () => ({
        start: () => Promise.reject(new Error('Mock')),
        stop,
        on() {},
        off() {},
        send() {},
      }),
    },
  })

  expect(stderr).toContain('Error: [vitest-pool]: Failed to start pool-with-crashing-workers worker for test files')
  expect(stderr).toContain('a.test.ts')
  expect(stderr).toContain('Caused by: Error: Mock')
  expect(stdout).toContain('Errors  1 error')

  expect(stop).toHaveBeenCalled()
})

async function getConfig<T = SerializedConfig>(options: Partial<TestUserConfig>, cliOptions: Partial<TestUserConfig> = {}): Promise<T> {
  let config: T | undefined

  await runVitest({
    root: './fixtures/pool',
    include: ['print-config.test.ts'],
    $cliOptions: cliOptions,
    onConsoleLog(log) {
      config = JSON.parse(log)
    },
    ...options,
  })

  assert(config)
  return config
}

function normalizeFilename(filename: string) {
  return normalize(filename)
    .replace(normalize(process.cwd()), '<process-cwd>')
}
