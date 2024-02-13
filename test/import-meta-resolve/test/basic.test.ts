import { expect, test } from 'vitest'

test('basic', () => {
  // relative path
  expect(
    cleanDir(import.meta.resolve('../package.json')),
  ).toMatchInlineSnapshot(`"__DIR__/test/import-meta-resolve/package.json"`)

  // not throw in latest NodeJS
  expect(cleanDir(import.meta.resolve('../no-such-file'))).toMatchInlineSnapshot(
    `"__DIR__/test/import-meta-resolve/no-such-file"`,
  )

  // with 2nd argument `parent`
  expect(
    cleanDir(
      import.meta.resolve('./package.json', new URL('..', import.meta.url)),
    ),
  ).toMatchInlineSnapshot(`"__DIR__/test/import-meta-resolve/package.json"`)

  // node_module
  expect(cleanDir(import.meta.resolve('vitest'))).toMatchInlineSnapshot(
    `"__DIR__/packages/vitest/dist/index.js"`,
  )

  expect(() =>
    cleanDir(import.meta.resolve('@vitest/not-such-module')),
  ).toThrow(
    expect.objectContaining({
      message: expect.stringContaining(
        'Cannot find package \'@vitest/not-such-module\' imported from',
      ),
    }),
  )
})

// make output deterministic
function cleanDir(out: string) {
  const dir = new URL('../../..', import.meta.url).toString()
  return out.replace(dir, '__DIR__/')
}
