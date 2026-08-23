import { mergeConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { resolveEsbuildOptions, resolveOxcOptions } from '../../../packages/vitest/src/node/plugins/transformTarget'

// https://github.com/vitest-dev/vitest/issues/11035
// Vitest's config plugin re-stated a user-provided `oxc.target`. Vite merges
// plugin-returned config into the user's config with `mergeConfig`, which
// concatenates arrays — so an array target ended up duplicated and OXC
// rejected it.

describe('resolveOxcOptions', () => {
  it('defaults the target when the user did not provide one', () => {
    expect(resolveOxcOptions(undefined)).toEqual({ target: 'node18' })
    expect(resolveOxcOptions({})).toEqual({ target: 'node18' })
  })

  it('does not restate a user-provided target', () => {
    expect(resolveOxcOptions({ target: ['chrome121', 'firefox118'] })).toEqual({})
    expect(resolveOxcOptions({ target: 'chrome121' })).toEqual({})
  })

  it('keeps oxc disabled when disabled by the user', () => {
    expect(resolveOxcOptions(false)).toBe(false)
  })

  it('keeps array targets duplicate-free after a vite config merge', () => {
    const userConfig = { oxc: { target: ['chrome121', 'firefox118'] } }
    const merged = mergeConfig(
      userConfig,
      { oxc: resolveOxcOptions(userConfig.oxc) },
    )
    expect(merged.oxc).toEqual({ target: ['chrome121', 'firefox118'] })
  })
})

describe('resolveEsbuildOptions', () => {
  it('defaults the target and keeps vitest-required options', () => {
    expect(resolveEsbuildOptions(undefined)).toEqual({
      target: 'node18',
      sourcemap: 'external',
      legalComments: 'inline',
    })
  })

  it('does not restate a user-provided target but preserves required options', () => {
    expect(resolveEsbuildOptions({ target: ['es2020', 'chrome100'] })).toEqual({
      sourcemap: 'external',
      legalComments: 'inline',
    })
  })

  it('keeps esbuild disabled when disabled by the user', () => {
    expect(resolveEsbuildOptions(false)).toBe(false)
  })
})
