import type { WorkerGlobalState } from '../../../packages/vitest/src/types/worker'
import { normalize } from 'pathe'
import { describe, expect, it } from 'vitest'
import { distDir } from '../../../packages/vitest/src/paths'
import { getCachedVitestImport } from '../../../packages/vitest/src/runtime/moduleRunner/cachedResolver'

// `distDir` is built with node:path, so it is back-slashed on Windows, while the
// resolver compares against the pathe-normalized form (as does `config.root`).
const normalizedDistDir = normalize(distDir)

function stateWithRoot(root: string): () => WorkerGlobalState {
  return () => ({ config: { root } }) as WorkerGlobalState
}

describe('getCachedVitestImport', () => {
  it('does not treat a bare Node builtin as a Vitest import when dist is outside the root', () => {
    // A root that is *not* an ancestor of the dist directory, but whose length is
    // two characters shorter, so `distDir.slice(root.length)` yields "st" — the
    // last two characters of ".../dist". That is how a monorepo package root
    // behaves when Vitest is hoisted above it.
    const root = `/${'a'.repeat(normalizedDistDir.length - 3)}`
    expect(normalizedDistDir.slice(root.length)).toBe('st')

    expect(getCachedVitestImport('stream', stateWithRoot(root))).toBeNull()
    expect(getCachedVitestImport('stream/promises', stateWithRoot(root))).toBeNull()
  })

  it('does not treat an unrelated bare specifier as a Vitest import', () => {
    const root = `/${'b'.repeat(normalizedDistDir.length - 2)}`
    expect(normalizedDistDir.slice(root.length)).toBe('t')

    expect(getCachedVitestImport('tls', stateWithRoot(root))).toBeNull()
    expect(getCachedVitestImport('timers', stateWithRoot(root))).toBeNull()
  })

  it('does not match a sibling directory whose name is a prefix of the root', () => {
    // e.g. root .../node_modules/vite, dist .../node_modules/vitest/dist:
    // slicing without a path boundary would yield "st/dist".
    const vitestDir = normalizedDistDir.slice(0, normalizedDistDir.lastIndexOf('/'))
    const siblingRoot = vitestDir.slice(0, -2)
    expect(normalizedDistDir.startsWith(siblingRoot)).toBe(true)

    expect(getCachedVitestImport('stream', stateWithRoot(siblingRoot))).toBeNull()
  })

  it('still externalizes ids relative to a root that contains the dist directory', () => {
    // Vitest installed inside the project, e.g. <root>/node_modules/.pnpm/vitest/dist
    const root = normalizedDistDir.slice(0, normalizedDistDir.lastIndexOf('/'))
    const relativeId = `${normalizedDistDir.slice(root.length)}/index.js`

    const result = getCachedVitestImport(relativeId, stateWithRoot(root))
    expect(result).not.toBeNull()
    expect(result!.externalize).toContain('index.js')
  })

  it('still externalizes absolute dist ids and bare vitest specifiers', () => {
    const root = normalize('/some/unrelated/project/root')

    expect(
      getCachedVitestImport(`${distDir}/index.js`, stateWithRoot(root)),
    ).not.toBeNull()
    expect(getCachedVitestImport('vitest', stateWithRoot(root))).toEqual({
      externalize: 'vitest',
      type: 'module',
    })
  })
})
