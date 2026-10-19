import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'pathe'
import { afterEach, expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

// The on-disk module cache is an optimisation. It lives in a directory nobody
// owns exclusively — CI images sweep it mid-run, disks fill up, mounts are
// mounted read-only — so every failure to write or read it has to degrade to
// serving the module inline instead of failing the run.

const restore: Array<() => void> = []

afterEach(() => {
  restore.splice(0).forEach((fn) => fn())
})

// Windows ignores the POSIX mode bits `chmodSync` sets on a directory, so there
// the cache stays writable and this scenario cannot be staged at all.
test.skipIf(process.platform === 'win32')(
  'a cache directory that cannot be written to does not fail the run',
  async () => {
    const cachePath = join(import.meta.dirname, '../fixtures/.tmp-readonly-module-cache')
    rmSync(cachePath, { force: true, recursive: true })
    mkdirSync(cachePath, { recursive: true })
    chmodSync(cachePath, 0o555)
    restore.push(() => {
      chmodSync(cachePath, 0o755)
      rmSync(cachePath, { force: true, recursive: true })
    })

    const { stderr, testTree } = await runInlineTests(
      {
        'sum.js': `export const sum = (a, b) => a + b`,
        'basic.test.js': /* js */ `
      import { expect, test } from "vitest"
      import { sum } from "./sum.js"
      test("still runs without a writable cache", () => {
        expect(sum(1, 2)).toBe(3)
      })
    `,
      },
      {
        fsModuleCache: true,
        fsModuleCachePath: cachePath,
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchObject({
      'basic.test.js': {
        'still runs without a writable cache': 'passed',
      },
    })
    // nothing could be written, and that is fine
    expect(readdirSync(cachePath)).toEqual([])
  },
)

test('a cached file removed mid-run is re-transformed instead of failing', async () => {
  const cachePath = join(import.meta.dirname, '../fixtures/.tmp-swept-module-cache')
  rmSync(cachePath, { force: true, recursive: true })
  restore.push(() => rmSync(cachePath, { force: true, recursive: true }))

  // `a` imports the shared module (populating the cache and the server's
  // in-memory pointer to it), then deletes the cache from under the run. `b`
  // imports the same module afterwards, so the server has to notice its
  // pointer is dangling and re-transform rather than hand back a dead path.
  const { stderr, testTree } = await runInlineTests(
    {
      'shared.js': `export const shared = "shared-value"`,
      'a.test.js': /* js */ `
      import { rmSync } from "node:fs"
      import { expect, test } from "vitest"
      import { shared } from "./shared.js"
      test("populates the cache, then sweeps it", () => {
        expect(shared).toBe("shared-value")
        rmSync(${JSON.stringify(cachePath)}, { force: true, recursive: true })
      })
    `,
      'b.test.js': /* js */ `
      import { expect, test } from "vitest"
      import { shared } from "./shared.js"
      test("still resolves the swept module", () => {
        expect(shared).toBe("shared-value")
      })
    `,
    },
    {
      fsModuleCache: true,
      fsModuleCachePath: cachePath,
      // run the files in order in one process so `a` reliably sweeps the cache
      // before `b` asks the server for the same module
      fileParallelism: false,
      maxWorkers: 1,
      minWorkers: 1,
      sequence: { shuffle: false },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchObject({
    'a.test.js': {
      'populates the cache, then sweeps it': 'passed',
    },
    'b.test.js': {
      'still resolves the swept module': 'passed',
    },
  })
})

test('the cache is still populated and reused when nothing interferes', async () => {
  const cachePath = join(import.meta.dirname, '../fixtures/.tmp-healthy-module-cache')
  rmSync(cachePath, { force: true, recursive: true })
  restore.push(() => rmSync(cachePath, { force: true, recursive: true }))

  const structure = {
    'sum.js': `export const sum = (a, b) => a + b`,
    'basic.test.js': /* js */ `
      import { expect, test } from "vitest"
      import { sum } from "./sum.js"
      test("adds", () => {
        expect(sum(1, 2)).toBe(3)
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: cachePath,
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(existsSync(cachePath)).toBe(true)
  const written = readdirSync(cachePath).length
  // the degradation paths must not have turned caching off altogether
  expect(written).toBeGreaterThan(0)

  const warm = await runInlineTests(structure, config)
  expect(warm.stderr).toBe('')
  expect(warm.testTree()).toMatchObject({
    'basic.test.js': { adds: 'passed' },
  })
})

test('cached modules are invalidated after every lockfile change', async () => {
  const firstRun = await runInlineTests({
    'package.json': JSON.stringify({ type: 'module' }),
    'vitest.config.js': /* js */ `
      export default {
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
          deps: {
            optimizer: {
              ssr: {
                enabled: true,
                include: ['optimized-dep'],
              },
            },
          },
        },
      }
    `,
    'node_modules/.pnpm/lock.yaml': 'lockfile generation 1',
    'node_modules/optimized-dep/package.json': JSON.stringify({
      name: 'optimized-dep',
      type: 'module',
      exports: './index.js',
    }),
    'node_modules/optimized-dep/index.js': `export default 'optimized'`,
    'node_modules/mocked-dep/package.json': JSON.stringify({
      name: 'mocked-dep',
      type: 'module',
      exports: './index.js',
    }),
    'node_modules/mocked-dep/index.js': `export default 'original'`,
    'subject.js': `
      import value from 'mocked-dep'
      export const getValue = () => value
    `,
    'basic.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'
      import { getValue } from './subject.js'

      vi.mock('mocked-dep', () => ({ default: 'mocked' }))

      test('uses the mock', () => {
        expect(getValue()).toBe('mocked')
      })
    `,
  })

  const fs = firstRun.fs
  const first = {
    errorTree: firstRun.errorTree(),
    stderr: firstRun.stderr,
  }
  await firstRun.ctx?.close()

  async function run() {
    const result = await runVitest({ root: fs.root })
    const errorTree = result.errorTree()
    await result.ctx?.close()
    return { errorTree, stderr: result.stderr }
  }

  fs.editFile('node_modules/.pnpm/lock.yaml', () => 'lockfile generation 2')
  const second = await run()
  fs.editFile('node_modules/.pnpm/lock.yaml', () => 'lockfile generation 3')
  const third = await run()

  expect([first.stderr, second.stderr, third.stderr]).toEqual(['', '', ''])
  expect([first.errorTree, second.errorTree, third.errorTree]).toMatchInlineSnapshot(`
    [
      {
        "basic.test.js": {
          "uses the mock": "passed",
        },
      },
      {
        "basic.test.js": {
          "uses the mock": "passed",
        },
      },
      {
        "basic.test.js": {
          "uses the mock": "passed",
        },
      },
    ]
  `)
})

// #11633: the bail-out for `import.meta.glob` only looked for the literal `import.meta.glob(`,
// so a call with a TypeScript type argument (`import.meta.glob<Record<string, unknown>>(...)`,
// which Vite's types document) was cached with the glob expanded to the files that existed at
// transform time. A file added since stayed invisible on every later run sharing the cache.
test('a typed import.meta.glob call is not cached with its expansion', async () => {
  const structure = {
    'vitest.config.js': /* js */ `
      export default {
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
        },
      }
    `,
    'src/a.js': 'export default 1',
    'src/b.js': 'export default 2',
    // the glob lives in its own module so its source is byte-identical across
    // runs: any difference in the result can only come from the cache. A type
    // argument needs a .ts module, like in the issue's reproduction.
    'glob.ts': /* js */ `
      export const files = import.meta.glob<Record<string, unknown>>('./src/*.js', { eager: true })
    `,
    'glob.test.js': /* js */ `
      import { readdirSync } from 'node:fs'
      import { expect, test } from 'vitest'
      import { files } from './glob.js'

      test('the glob sees every file on disk', () => {
        const onDisk = readdirSync(new URL('./src', import.meta.url)).map(name => './src/' + name)
        expect(Object.keys(files).sort()).toEqual(onDisk.sort())
      })
    `,
  }

  const firstRun = await runInlineTests(structure)
  expect(firstRun.stderr).toBe('')
  expect(firstRun.testTree()).toMatchObject({
    'glob.test.js': { 'the glob sees every file on disk': 'passed' },
  })
  const fs = firstRun.fs
  await firstRun.ctx?.close()

  // `glob.ts` is unchanged, so a cache hit serves the old expansion — the new
  // file must still show up.
  fs.createFile('src/c.js', 'export default 3')

  const secondRun = await runVitest({ root: fs.root })
  const stderr = secondRun.stderr
  const testTree = secondRun.testTree()
  await secondRun.ctx?.close()

  expect(stderr).toBe('')
  expect(testTree).toMatchObject({
    'glob.test.js': { 'the glob sees every file on disk': 'passed' },
  })
})
