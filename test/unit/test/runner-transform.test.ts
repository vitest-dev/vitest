import { builtinModules } from 'node:module'
import { describe, expect, test } from 'vitest'
import { resolveBuiltinExternalModules } from '../../../packages/vitest/src/node/plugins/runnerTransform'

describe('resolveBuiltinExternalModules', () => {
  test('adds a node: alias for bare built-ins', () => {
    const external = resolveBuiltinExternalModules(['fs', 'path'])
    expect(external).toEqual(['fs', 'node:fs', 'path', 'node:path'])
  })

  test('does not double-prefix built-ins that are already node: prefixed', () => {
    // Newer Node versions expose some built-ins only in prefixed form.
    const external = resolveBuiltinExternalModules([
      'fs',
      'node:sea',
      'node:sqlite',
      'node:test',
      'node:test/reporters',
    ])

    expect(external).not.toContain('node:node:sea')
    expect(external.some(m => m.startsWith('node:node:'))).toBe(false)
    expect(external).toEqual([
      'fs',
      'node:fs',
      'node:sea',
      'node:sqlite',
      'node:test',
      'node:test/reporters',
    ])
  })

  test('never produces a double node: prefix for the current runtime built-ins', () => {
    const external = resolveBuiltinExternalModules(builtinModules)
    expect(external.filter(m => m.startsWith('node:node:'))).toEqual([])
  })
})
