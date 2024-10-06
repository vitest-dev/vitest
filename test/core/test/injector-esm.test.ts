import { parseAst } from 'rollup/parseAst'
import { expect, test } from 'vitest'
import { injectDynamicImport } from '../../../packages/mocker/src/node/dynamicImportPlugin'

function parse(code: string, options: any) {
  return parseAst(code, options)
}

function injectSimpleCode(code: string) {
  return injectDynamicImport(code, '/test.js', parse)?.code
}

test('dynamic import', async () => {
  const result = injectSimpleCode(
    'export const i = () => import(\'./foo\')',
  )
  expect(result).toMatchInlineSnapshot(`"export const i = () => globalThis["__vitest_mocker__"].wrapDynamicImport(() => import('./foo'))"`)
})
