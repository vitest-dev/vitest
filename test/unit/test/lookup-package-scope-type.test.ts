import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lookupPackageScopeType } from '@vitest/utils/resolver'
import { expect, it, onTestFinished } from 'vitest'

function scaffold(tree: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'vitest-scope-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  for (const [relativePath, type] of Object.entries(tree)) {
    const dir = join(root, relativePath)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify(type ? { type } : {}))
  }
  return root
}

it('resolves the "type" of the nearest package.json', () => {
  const root = scaffold({ '.': 'module' })
  expect(lookupPackageScopeType(join(root, 'src', 'nested'))).toBe('esm')
})

it('reports "commonjs" scopes as cjs and typeless scopes as none', () => {
  const cjsRoot = scaffold({ '.': 'commonjs' })
  const typelessRoot = scaffold({ '.': '' })
  expect(lookupPackageScopeType(cjsRoot)).toBe('cjs')
  expect(lookupPackageScopeType(typelessRoot)).toBe('none')
})

it('stops at the node_modules boundary and does not inherit the project type', () => {
  const root = scaffold({
    '.': 'module',
    'node_modules/dep-cjs': 'commonjs',
  })
  // a typeless dependency must not inherit the project's `type: module`
  expect(lookupPackageScopeType(join(root, 'node_modules', 'dep-typeless'))).toBe('none')
  // but a dependency's own package.json still wins
  expect(lookupPackageScopeType(join(root, 'node_modules', 'dep-cjs'))).toBe('cjs')
})
