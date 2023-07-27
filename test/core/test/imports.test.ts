import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { dynamicRelativeImport } from '../src/relative-import'

// @ts-expect-error module is not typed
import promiseExport from '../src/cjs/promise-export'

test('promise export works correctly', async () => {
  await expect(promiseExport).resolves.toEqual({ value: 42 })
})

test('dynamic relative import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('Relative imports in imported modules work', async () => {
  const relativeImportFromFile = await dynamicRelativeImport('timeout')
  const directImport = await import('./../src/timeout')

  expect(relativeImportFromFile).toBe(directImport)
})

test('dynamic aliased import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '#/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('dynamic absolute from root import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('dynamic absolute with extension import works', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '/src/timeout.ts'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('data with dynamic import works', async () => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import(dataUri)
  expect(hi).toBe('hi')
})

test('dynamic import coerces to string', async () => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import({ toString: () => dataUri } as string)
  expect(hi).toBe('hi')
})

test('dynamic import has Module symbol', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  // @ts-expect-error The symbol won't exist on the import type
  expect(stringTimeoutMod[Symbol.toStringTag]).toBe('Module')
})

test('dynamic import has null prototype', async () => {
  const stringTimeoutMod = await import('./../src/timeout')

  expect(Object.getPrototypeOf(stringTimeoutMod)).toBe(null)
})

test('dynamic import throws an error', async () => {
  const path = './some-unknown-path'
  const imported = import(path)
  await expect(imported).rejects.toThrowError(/Failed to load url \.\/some-unknown-path/)
  // @ts-expect-error path does not exist
  await expect(() => import('./some-unknown-path')).rejects.toThrowError(/Failed to load/)
})

test('can import @vite/client', async () => {
  const name = '@vite/client'
  await expect(import(name)).resolves.not.toThrow()
  await expect(import(`/${name}`)).resolves.not.toThrow()
})

describe('importing special files from node_modules', async () => {
  const dir = resolve(__dirname, '../src/node_modules')
  const wasm = resolve(dir, 'file.wasm')
  const css = resolve(dir, 'file.css')
  const mp3 = resolve(dir, 'file.mp3')
  await mkdir(dir, { recursive: true })
  await Promise.all([
    writeFile(wasm, '(module)'),
    writeFile(css, '.foo { color: red; }'),
    writeFile(mp3, ''),
  ])
  const importModule = (path: string) => import(path)

  test('importing wasm with ?url query', async () => {
    const mod = await importModule('../src/node_modules/file.wasm?url')
    expect(mod.default).toBe('/src/node_modules/file.wasm')
  })

  test('importing wasm with ?raw query', async () => {
    const mod = await importModule('../src/node_modules/file.wasm?raw')
    expect(mod.default).toBe('(module)')
  })

  test('importing wasm with ?init query', async () => {
    const mod = await importModule('../src/node_modules/file.wasm?init')
    expect(mod.default).toBeTypeOf('function')
  })

  test('importing css with ?inline query', async () => {
    const mod = await importModule('../src/node_modules/file.css?inline')
    expect(mod.default).toBeTypeOf('string')
  })

  test('importing asset returns a string', async () => {
    const mod = await importModule('../src/node_modules/file.mp3')
    expect(mod.default).toBe('/src/node_modules/file.mp3')
  })
})
