import { Parser } from 'acorn'
import { injectVitestModule } from 'vitest/src/node/esmInjector'
import { expect, test } from 'vitest'

function parse(code: string, options: any) {
  return Parser.parse(code, options)
}

function injectSimpleCode(code: string) {
  return injectVitestModule(code, '/test.js', parse, {
    hijackESM: false,
    cacheDir: '/tmp',
  })?.code.trim()
}

function injectHijackedCode(code: string) {
  return injectVitestModule(code, '/test.js', parse, {
    hijackESM: true,
    cacheDir: '/tmp',
  })?.code.trim()
}

test('hoists mock, unmock, hoisted', () => {
  expect(injectSimpleCode(`
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  `)).toMatchInlineSnapshot(`
    "if (typeof globalThis.vi === \\"undefined\\" && typeof globalThis.vitest === \\"undefined\\") { throw new Error(\\"There are some problems in resolving the mocks API.\\\\nYou may encounter this issue when importing the mocks API from another module other than 'vitest'.\\\\nTo fix this issue you can either:\\\\n- import the mocks API directly from 'vitest'\\\\n- enable the 'globals' options\\") }
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})"
  `)
})

test('always hoists import from vitest', () => {
  expect(injectSimpleCode(`
  import { vi } from 'vitest'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "import { vi } from 'vitest'
    import { test } from 'vitest'
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})"
  `)
})

test('always hoists mock, unmock, hoisted when modules are hijacked', () => {
  expect(injectHijackedCode(`
  import { vi } from 'vitest'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vitest'
    const { vi } = __vi_esm_0__;
    import { __vi_inject__ as __vi_esm_1__ } from 'vitest'
    const { test } = __vi_esm_1__;
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})"
  `)
})

test('always hoists all imports but they are under mocks', () => {
  expect(injectSimpleCode(`
  import { vi } from 'vitest'
  import { someValue } from './path.js'
  import { someValue2 } from './path2.js'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "import { vi } from 'vitest'
    import { test } from 'vitest'
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})
    const { someValue } = await import('./path.js')
    const { someValue2 } = await import('./path2.js')"
  `)
})

test('always hoists all imports but they are under mocks when modules are hijacked', () => {
  expect(injectHijackedCode(`
  import { vi } from 'vitest'
  import { someValue } from './path.js'
  import { someValue2 } from './path2.js'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vitest'
    const { vi } = __vi_esm_0__;
    import { __vi_inject__ as __vi_esm_3__ } from 'vitest'
    const { test } = __vi_esm_3__;
    vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})
    const { __vi_inject__: __vi_esm_1__ } = await __vi_wrap_module__(import('./path.js'))
    const { __vi_inject__: __vi_esm_2__ } = await __vi_wrap_module__(import('./path2.js'))"
  `)
})
