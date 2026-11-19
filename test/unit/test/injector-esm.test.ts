import { expect, test } from 'vitest'
import { injectDynamicImport } from '../../../packages/mocker/src/node/dynamicImportPlugin'

function injectSimpleCode(code: string) {
  return injectDynamicImport(code, '/test.js')?.code
}

test('dynamic import', async () => {
  const result = injectSimpleCode("export const i = () => import('./foo')")
  expect(result).toMatchInlineSnapshot(
    `"export const i = () => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import('./foo'))"`,
  )
})

test('dynamic import with await in the argument', async () => {
  const result = injectSimpleCode('export const i = async () => import(await getSpecifier())')
  expect(result).toMatchInlineSnapshot(
    `"export const i = async () => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import(await getSpecifier()))"`,
  )
})

test('dynamic import keeps comments and options', async () => {
  const result = injectSimpleCode(
    "export const i = (url) => import(/* @vite-ignore */ url, { with: { type: 'json' } })",
  )
  expect(result).toMatchInlineSnapshot(
    `"export const i = (url) => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import(/* @vite-ignore */ url, { with: { type: 'json' } }))"`,
  )
})

test('nested dynamic import', async () => {
  const result = injectSimpleCode("export const i = () => import(import('./a').then((m) => m.b))")
  expect(result).toMatchInlineSnapshot(
    `"export const i = () => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import(globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import('./a')).then((m) => m.b)))"`,
  )
})

test('dynamic import in a template literal', async () => {
  const result = injectSimpleCode(`export const i = \`\${await import('./a')}\``)
  expect(result).toMatchInlineSnapshot(
    `"export const i = \`\${await globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import('./a'))}\`"`,
  )
})

test('deferred dynamic import keeps its phase', async () => {
  const result = injectSimpleCode("export const i = () => import.defer('./a')")
  expect(result).toMatchInlineSnapshot(
    `"export const i = () => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import.defer('./a'))"`,
  )
})

test('ignores code without a dynamic import', async () => {
  const result = injectSimpleCode(
    [
      "const s = 'import(x)'",
      'const r = /import\\(/',
      "obj.import('./a')",
      'class A { import(x) { return x } }',
      'console.log(import.meta.url)',
    ].join('\n'),
  )
  expect(result).toBeUndefined()
})
