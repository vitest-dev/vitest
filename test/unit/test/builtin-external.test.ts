import { expect, test } from 'vitest'
import { resolveBuiltinExternalModules } from '../../../packages/vitest/src/node/plugins/runnerTransform'

test('does not double-prefix node-only builtin modules', () => {
  const external = resolveBuiltinExternalModules([
    'fs',
    'node:sea',
    'node:sqlite',
    'node:test',
    'node:test/reporters',
  ])

  expect(external).toContain('fs')
  expect(external).toContain('node:fs')
  expect(external).toContain('node:sea')
  expect(external).toContain('node:sqlite')
  expect(external).toContain('node:test')
  expect(external).toContain('node:test/reporters')
  expect(external).not.toContain('node:node:sea')
  expect(external).not.toContain('node:node:sqlite')
  expect(external).not.toContain('node:node:test')
  expect(external).not.toContain('node:node:test/reporters')
})
