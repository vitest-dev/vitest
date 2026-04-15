import type { BaseCoverageProvider, CoverageOptions } from 'vitest/node'
import { join, resolve, sep } from 'node:path'
import { Writable } from 'node:stream'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

test('include nested, exclude top level', async () => {
  const isIncluded = await init({
    include: ['**/*.ts'],
    exclude: ['*.ts'],
  })

  expect.soft(isIncluded('top-level.ts')).toBe(false)
  expect.soft(isIncluded('src/nested.ts')).toBe(true)
})

test('exclude directory that is also in cwd', async () => {
  const cwd = process.cwd()
  expect(cwd).toContain(join(sep, 'vitest'))

  const isIncluded = await init({
    include: ['src/**/*.ts'],
    exclude: ['**/vitest/**', join('**', sep, 'vitest', sep, '**')],
  })

  expect(isIncluded('src/example.ts')).toBe(true)
})

test('include with exact match', async () => {
  const isIncluded = await init({
    include: ['src/**/*.ts', 'utils/setupFile.ts'],
  })

  expect(isIncluded('utils/setupFile.ts')).toBe(true)
})

test('include with partial extension match', async () => {
  const isIncluded = await init({
    include: ['**/*.js'],
  })

  expect.soft(isIncluded('setupFile.js')).toBe(true)
  expect.soft(isIncluded('component.jsx')).toBe(false)
  expect.soft(isIncluded('package.json')).toBe(false)
})

test('include without actual glob', async () => {
  const isIncluded = await init({
    include: ['src', 'another/nested'],
  })

  expect.soft(isIncluded('src/component.js')).toBe(true)
  expect.soft(isIncluded('src/nested/component.ts')).toBe(true)

  expect.soft(isIncluded('another/nested/component.ts')).toBe(true)
  expect.soft(isIncluded('another/nested/deeply/component.ts')).toBe(true)
  expect.soft(isIncluded('another/nested-ignored.js')).toBe(false)

  expect.soft(isIncluded('src-file-in-root.js')).toBe(false)
})

test('no include defaults to match all files', async () => {
  const isIncluded = await init({
    exclude: [],
  })

  expect.soft(isIncluded('src/anything.ts')).toBe(true)
  expect.soft(isIncluded('deeply/nested/dir/file.js')).toBe(true)
})

test('exclude takes priority over include', async () => {
  const isIncluded = await init({
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.ts'],
  })

  expect(isIncluded('src/example.ts')).toBe(false)
})

test('multiple include patterns', async () => {
  const isIncluded = await init({
    include: ['src/**/*.ts', 'lib/**/*.ts'],
    exclude: [],
  })

  expect.soft(isIncluded('src/foo.ts')).toBe(true)
  expect.soft(isIncluded('lib/bar.ts')).toBe(true)
  expect.soft(isIncluded('other/baz.ts')).toBe(false)
})

test('multiple exclude patterns', async () => {
  const isIncluded = await init({
    include: ['**/*.ts'],
    exclude: ['**/*.test.ts', '**/*.spec.ts'],
  })

  expect.soft(isIncluded('src/foo.ts')).toBe(true)
  expect.soft(isIncluded('src/foo.test.ts')).toBe(false)
  expect.soft(isIncluded('src/foo.spec.ts')).toBe(false)
})

test('dot files are matched when using dot patterns', async () => {
  const isIncluded = await init({
    include: ['**/*.ts'],
    exclude: [],
  })

  expect.soft(isIncluded('.hidden/file.ts')).toBe(true)
  expect.soft(isIncluded('src/.hidden.ts')).toBe(true)
})

test('files outside project when allowExternal: false', async () => {
  const isIncluded = await init({
    include: ['**/*.ts'],
    exclude: ['**/package-b/**'],
    allowExternal: false,
  })

  expect(isIncluded(resolve(process.cwd(), '../../package-a/src/one.ts'))).toBe(false)
  expect(isIncluded(resolve(process.cwd(), '../../package-b/src/two.ts'))).toBe(false)
})

test('files outside project when allowExternal: true', async () => {
  const isIncluded = await init({
    include: ['**/*.ts'],
    exclude: ['**/package-b/**'],
    allowExternal: true,
  })

  expect(isIncluded(resolve(process.cwd(), '../../package-a/src/one.ts'))).toBe(true)
  expect(isIncluded(resolve(process.cwd(), '../../package-b/src/two.ts'))).toBe(false)
})

async function init(options: Partial<CoverageOptions>) {
  const vitest = await createVitest('test', {
    config: false,
    include: ['dont-match-anything'],
    coverage: {
      ...options,
      enabled: true,
      provider: 'v8',
    },
  }, {}, { stdout: new Writable() })

  onTestFinished(() => vitest.close())
  await vitest.init()

  const provider = vitest.coverageProvider as unknown as BaseCoverageProvider

  return (path: string) => provider.isIncluded(resolve(process.cwd(), path))
}
