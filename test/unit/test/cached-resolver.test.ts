import type { WorkerGlobalState } from '../../../packages/vitest/src/types/worker'
import { pathToFileURL } from 'node:url'
import { dirname, normalize } from 'pathe'
import { describe, expect, test } from 'vitest'
import { distDir } from '../../../packages/vitest/src/paths'
import { getCachedVitestImport } from '../../../packages/vitest/src/runtime/moduleRunner/cachedResolver'

const normalizedDistDir = normalize(distDir)

function stateWithRoot(root: string): () => WorkerGlobalState {
  return () => ({ config: { root } }) as WorkerGlobalState
}

function unrelatedRootForSuffix(suffix: string, fill: string): string {
  return `/${fill.repeat(normalizedDistDir.length - suffix.length - 1)}`
}

describe('getCachedVitestImport', () => {
  test('does not resolve a bare builtin relative to an unrelated root', () => {
    const root = unrelatedRootForSuffix('t', 'a')
    expect(normalizedDistDir.slice(root.length)).toBe('t')

    expect(getCachedVitestImport('timers', stateWithRoot(root))).toBeNull()
  })

  test('does not resolve a builtin subpath relative to an unrelated root', () => {
    const root = unrelatedRootForSuffix('st', 'b')
    expect(normalizedDistDir.slice(root.length)).toBe('st')

    expect(getCachedVitestImport('stream/promises', stateWithRoot(root))).toBeNull()
  })

  test('does not derive a relative path from a sibling root prefix', () => {
    const root = normalizedDistDir.slice(0, -'st/dist'.length)
    expect(normalizedDistDir.slice(root.length)).toBe('st/dist')

    expect(getCachedVitestImport('st/dist/index.js', stateWithRoot(root))).toBeNull()
  })

  test('resolves a dist path relative to an ancestor root', () => {
    const root = dirname(normalizedDistDir)
    const id = `${normalizedDistDir.slice(root.length)}/index.js?relative`

    expect(getCachedVitestImport(id, stateWithRoot(root))).toEqual({
      externalize: `${pathToFileURL(`${normalizedDistDir}/index.js`)}?relative`,
      type: 'module',
    })
  })

  test('still resolves absolute and bare Vitest imports', () => {
    const root = unrelatedRootForSuffix('test', 'c')
    const id = `${normalizedDistDir}/index.js?absolute`

    expect(getCachedVitestImport(id, stateWithRoot(root))).toEqual({
      externalize: `${pathToFileURL(`${normalizedDistDir}/index.js`)}?absolute`,
      type: 'module',
    })
    expect(getCachedVitestImport('vitest/config', stateWithRoot(root))).toEqual({
      externalize: 'vitest/config',
      type: 'module',
    })
  })
})
