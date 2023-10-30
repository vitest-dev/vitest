import { Parser } from 'acorn'
import { expect, test } from 'vitest'
import { hoistMocks } from '../../../packages/vitest/src/node/hoistMocks'

function parse(code: string, options: any) {
  return Parser.parse(code, options)
}

function hoistSimpleCode(code: string) {
  return hoistMocks(code, '/test.js', parse)?.code.trim()
}

test('hoists mock, unmock, hoisted', () => {
  expect(hoistSimpleCode(`
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  `)).toMatchInlineSnapshot(`
    "if (typeof globalThis.vi === "undefined" && typeof globalThis.vitest === "undefined") { throw new Error("There are some problems in resolving the mocks API.\\nYou may encounter this issue when importing the mocks API from another module other than 'vitest'.\\nTo fix this issue you can either:\\n- import the mocks API directly from 'vitest'\\n- enable the 'globals' options") }
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})"
  `)
})

test('always hoists import from vitest', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "const { vi } = await import('vitest')
    const { test } = await import('vitest')
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})"
  `)
})

test('always hoists all imports but they are under mocks', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  import { someValue } from './path.js'
  import { someValue2 } from './path2.js'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "const { vi } = await import('vitest')
    const { test } = await import('vitest')
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})
    const { someValue } = await import('./path.js')
    const { someValue2 } = await import('./path2.js')"
  `)
})

test('correctly mocks namespaced', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  import add, * as AddModule from '../src/add'
  vi.mock('../src/add', () => {})
  `)).toMatchInlineSnapshot(`
    "const { vi } = await import('vitest')
    vi.mock('../src/add', () => {})
    const AddModule = await import('../src/add')
    const { default: add } = AddModule"
  `)
})
