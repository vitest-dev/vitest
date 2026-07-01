import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  clearSmartRerunCache,
  filterToFailedSpecs,
  getSmartRerunCachePath,
  prioritizeFailedSpecs,
  readSmartRerunCache,
  smartRerunCacheFilename,
  writeSmartRerunCache,
} from '../../../packages/vitest/src/node/cache/smart-rerun'
import { TestSpecification } from '../../../packages/vitest/src/node/test-specification'

function buildWorkspace() {
  return {
    name: 'test',
    config: {
      root: import.meta.dirname,
      sequence: { groupOrder: 0 },
    },
  } as any
}

const workspace = buildWorkspace()

function specs(files: string[]) {
  return files.map(file => new TestSpecification(workspace, file, 'forks'))
}

describe('smart rerun cache', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(join(tmpdir(), 'vitest-smart-rerun-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('saves the failed file paths to .vitest-failed-cache.json', async () => {
    await writeSmartRerunCache(root, ['/repo/a.test.ts', '/repo/b.test.ts'])

    const cachePath = getSmartRerunCachePath(root)
    expect(cachePath.endsWith(smartRerunCacheFilename)).toBe(true)
    expect(fs.existsSync(cachePath)).toBe(true)
    expect(JSON.parse(fs.readFileSync(cachePath, 'utf8'))).toEqual({
      failedFiles: ['/repo/a.test.ts', '/repo/b.test.ts'],
    })
  })

  test('loads the failed file paths that were previously saved', async () => {
    await writeSmartRerunCache(root, ['/repo/a.test.ts'])
    expect(await readSmartRerunCache(root)).toEqual(['/repo/a.test.ts'])
  })

  test('loading returns an empty array when no cache file exists yet', async () => {
    expect(await readSmartRerunCache(root)).toEqual([])
  })

  test('loading returns an empty array when the cache file is corrupted', async () => {
    fs.writeFileSync(getSmartRerunCachePath(root), 'not valid json')
    expect(await readSmartRerunCache(root)).toEqual([])
  })

  test('clears the cache file once all tests pass', async () => {
    await writeSmartRerunCache(root, ['/repo/a.test.ts'])
    await clearSmartRerunCache(root)
    expect(fs.existsSync(getSmartRerunCachePath(root))).toBe(false)
  })

  test('clearing a cache file that does not exist is a no-op', async () => {
    await expect(clearSmartRerunCache(root)).resolves.not.toThrow()
  })
})

describe('prioritizeFailedSpecs', () => {
  test('moves a previously failed file to the front of the queue', () => {
    const files = specs(['a', 'b', 'c'])
    const sorted = prioritizeFailedSpecs(files, ['b'])
    expect(sorted).toStrictEqual(specs(['b', 'a', 'c']))
  })

  test('moves multiple previously failed files to the front, preserving their relative order', () => {
    const files = specs(['a', 'b', 'c', 'd'])
    const sorted = prioritizeFailedSpecs(files, ['c', 'a'])
    expect(sorted).toStrictEqual(specs(['a', 'c', 'b', 'd']))
  })

  test('returns the same specs untouched when there are no previously failed files', () => {
    const files = specs(['a', 'b', 'c'])
    expect(prioritizeFailedSpecs(files, [])).toBe(files)
  })

  test('ignores failed paths that no longer match any spec', () => {
    const files = specs(['a', 'b'])
    expect(prioritizeFailedSpecs(files, ['/no-longer-exists.test.ts'])).toStrictEqual(files)
  })
})

describe('filterToFailedSpecs', () => {
  test('keeps only the specs that previously failed', () => {
    const files = specs(['a', 'b', 'c'])
    expect(filterToFailedSpecs(files, ['b'])).toStrictEqual(specs(['b']))
  })

  test('keeps multiple previously failed specs, preserving their relative order', () => {
    const files = specs(['a', 'b', 'c', 'd'])
    expect(filterToFailedSpecs(files, ['c', 'a'])).toStrictEqual(specs(['a', 'c']))
  })

  test('returns the same specs untouched when there are no previously failed files', () => {
    const files = specs(['a', 'b', 'c'])
    expect(filterToFailedSpecs(files, [])).toBe(files)
  })

  test('falls back to every spec when none of the failed paths match', () => {
    const files = specs(['a', 'b'])
    expect(filterToFailedSpecs(files, ['/no-longer-exists.test.ts'])).toStrictEqual(files)
  })
})
