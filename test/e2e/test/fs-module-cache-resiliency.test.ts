import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'pathe'
import { afterEach, expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

// The on-disk module cache is an optimisation. It lives in a directory nobody
// owns exclusively — CI images sweep it mid-run, disks fill up, mounts are
// mounted read-only — so every failure to write or read it has to degrade to
// serving the module inline instead of failing the run.

const restore: Array<() => void> = []

afterEach(() => {
  restore.splice(0).forEach(fn => fn())
})

// Windows ignores the POSIX mode bits `chmodSync` sets on a directory, so there
// the cache stays writable and this scenario cannot be staged at all.
test.skipIf(process.platform === 'win32')('a cache directory that cannot be written to does not fail the run', async () => {
  const cachePath = join(
    import.meta.dirname,
    '../fixtures/.tmp-readonly-module-cache',
  )
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
})

test('a cached file removed mid-run is re-transformed instead of failing', async () => {
  const cachePath = join(
    import.meta.dirname,
    '../fixtures/.tmp-swept-module-cache',
  )
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
  const cachePath = join(
    import.meta.dirname,
    '../fixtures/.tmp-healthy-module-cache',
  )
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
