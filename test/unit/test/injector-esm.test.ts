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
    `"export const i = async () => globalThis["__vitest_mocker__"].wrapDynamicImport(async (__vi_specifier__) => import(__vi_specifier__), await getSpecifier(), "/test.js")"`,
  )
})

test('dynamic import with a variable passes the specifier and the importer', async () => {
  const result = injectSimpleCode('export const load = (path) => import(path)')
  expect(result).toMatchInlineSnapshot(
    `"export const load = (path) => globalThis["__vitest_mocker__"].wrapDynamicImport(async (__vi_specifier__) => import(__vi_specifier__), path, "/test.js")"`,
  )
})

test('dynamic import with a template literal keeps import attributes', async () => {
  const result = injectSimpleCode(
    `export const load = (name) => import(/* @vite-ignore */ \`./locales/\${name}.json\`, { with: { type: "json" } })`,
  )
  expect(result).toMatchInlineSnapshot(
    `"export const load = (name) => globalThis["__vitest_mocker__"].wrapDynamicImport(async (__vi_specifier__) => import(/* @vite-ignore */ __vi_specifier__, { with: { type: "json" } }), \`./locales/\${name}.json\`, "/test.js")"`,
  )
})

test('dynamic import with a static template literal', async () => {
  const result = injectSimpleCode('export const load = () => import(`./foo`)')
  expect(result).toMatchInlineSnapshot(
    `"export const load = () => globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import(\`./foo\`))"`,
  )
})

test('dynamic import keeps comments and options', async () => {
  const result = injectSimpleCode(
    "export const i = (url) => import(/* @vite-ignore */ url, { with: { type: 'json' } })",
  )
  expect(result).toMatchInlineSnapshot(
    `"export const i = (url) => globalThis["__vitest_mocker__"].wrapDynamicImport(async (__vi_specifier__) => import(/* @vite-ignore */ __vi_specifier__, { with: { type: 'json' } }), url, "/test.js")"`,
  )
})

test('nested dynamic import', async () => {
  const result = injectSimpleCode("export const i = () => import(import('./a').then((m) => m.b))")
  expect(result).toMatchInlineSnapshot(
    `"export const i = () => globalThis["__vitest_mocker__"].wrapDynamicImport(async (__vi_specifier__) => import(__vi_specifier__), globalThis["__vitest_mocker__"].wrapDynamicImport(async () => import('./a')).then((m) => m.b), "/test.js")"`,
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
