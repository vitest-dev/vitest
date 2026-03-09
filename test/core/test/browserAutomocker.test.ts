import { automockModule } from '@vitest/mocker/node'
import { parseAst } from 'vite'
import { expect, it } from 'vitest'

function automock(code: string) {
  return automockModule(code, 'automock', parseAst).toString()
}

it('correctly parses function declaration', () => {
  expect(automock(`
export function test() {}
  `)).toMatchInlineSnapshot(`
    "
    function test() {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    export {
      __vitest_mocked_0__ as test,
    }
    "
  `)
})

it('correctly parses class declaration', () => {
  expect(automock(`
export class Test {}
  `)).toMatchInlineSnapshot(`
    "
    class Test {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["Test"]: Test,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["Test"]
    export {
      __vitest_mocked_0__ as Test,
    }
    "
  `)
})

it('correctly parses default export', () => {
  expect(automock(`
export default class Test {}
  `)).toMatchInlineSnapshot(`
    "
    const __vitest_default = class Test {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)

  expect(automock(`
export default function test() {}
  `)).toMatchInlineSnapshot(`
    "
    const __vitest_default = function test() {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)

  expect(automock(`
export default someVariable
  `)).toMatchInlineSnapshot(`
    "
    const __vitest_default = someVariable
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)

  expect(automock(`
export default 'test'
  `)).toMatchInlineSnapshot(`
    "
    const __vitest_default = 'test'
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)

  expect(automock(`
export default null
  `)).toMatchInlineSnapshot(`
    "
    const __vitest_default = null
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)

  expect(automock(`
const test = '123'
export default test
  `)).toMatchInlineSnapshot(`
    "
    const test = '123'
    const __vitest_default = test
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_default"]: __vitest_default,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_default"]
    export {
      __vitest_mocked_0__ as default,
    }
    "
  `)
})

it('correctly parses const export', () => {
  expect(automock(`
export const test = 'test'
export const test2 = () => {}
export const test3 = function test4() {}
  `)).toMatchInlineSnapshot(`
    "
    const test = 'test'
    const test2 = () => {}
    const test3 = function test4() {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
      ["test2"]: test2,
      ["test3"]: test3,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["test2"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["test3"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as test2,
      __vitest_mocked_2__ as test3,
    }
    "
  `)
})

it('correctly parses const array pattern', () => {
  expect(automock(`
export const [test, ...rest] = []
export const [...rest2] = []
  `)).toMatchInlineSnapshot(`
    "
    const [test, ...rest] = []
    const [...rest2] = []
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
      ["rest"]: rest,
      ["rest2"]: rest2,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["rest"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["rest2"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as rest,
      __vitest_mocked_2__ as rest2,
    }
    "
  `)
})

it('correctly parses several declarations', () => {
  expect(automock(`
export const test = 2, test2 = 3, test4 = () => {}, test5 = function() {};
  `)).toMatchInlineSnapshot(`
    "
    const test = 2, test2 = 3, test4 = () => {}, test5 = function() {};
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
      ["test2"]: test2,
      ["test4"]: test4,
      ["test5"]: test5,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["test2"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["test4"]
    const __vitest_mocked_3__ = __vitest_mocked_module__["test5"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as test2,
      __vitest_mocked_2__ as test4,
      __vitest_mocked_3__ as test5,
    }
    "
  `)
})

it('correctly parses object pattern', () => {
  expect(automock(`
export const { test, ...rest } = {}
export const { test: alias } = {}
export const { ...rest2 } = {}
  `)).toMatchInlineSnapshot(`
    "
    const { test, ...rest } = {}
    const { test: alias } = {}
    const { ...rest2 } = {}
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
      ["rest"]: rest,
      ["alias"]: alias,
      ["rest2"]: rest2,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["rest"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["alias"]
    const __vitest_mocked_3__ = __vitest_mocked_module__["rest2"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as rest,
      __vitest_mocked_2__ as alias,
      __vitest_mocked_3__ as rest2,
    }
    "
  `)
})

it('correctly parses export specifiers', () => {
  expect(automock(`
  export const test = '1'
  export { test as "test3", test as test4 }
  `)).toMatchInlineSnapshot(`
    "
      const test = '1'
      
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["test"]: test,
      ["test"]: test,
      ["test"]: test,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["test"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["test"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as "test3",
      __vitest_mocked_2__ as test4,
    }
    "
  `)
})

it('correctly parses exports from sources', () => {
  expect(automock(`
export { test, test as test3, name as "name3" } from './module'
import { testing as name4 } from './another-module'
export { testing as name4 } from './another-module'
  `)).toMatchInlineSnapshot(`
    "
    import { test as __vitest_imported_0__, test as __vitest_imported_1__, name as __vitest_imported_2__ } from './module'
    import { testing as name4 } from './another-module'
    import { testing as __vitest_imported_3__ } from './another-module'
      
    const __vitest_current_es_module__ = {
      __esModule: true,
      ["__vitest_imported_0__"]: __vitest_imported_0__,
      ["__vitest_imported_1__"]: __vitest_imported_1__,
      ["__vitest_imported_2__"]: __vitest_imported_2__,
      ["__vitest_imported_3__"]: __vitest_imported_3__,
    }
    const __vitest_mocked_module__ = globalThis["__vitest_mocker__"].mockObject(__vitest_current_es_module__, "automock")
    const __vitest_mocked_0__ = __vitest_mocked_module__["__vitest_imported_0__"]
    const __vitest_mocked_1__ = __vitest_mocked_module__["__vitest_imported_1__"]
    const __vitest_mocked_2__ = __vitest_mocked_module__["__vitest_imported_2__"]
    const __vitest_mocked_3__ = __vitest_mocked_module__["__vitest_imported_3__"]
    export {
      __vitest_mocked_0__ as test,
      __vitest_mocked_1__ as test3,
      __vitest_mocked_2__ as "name3",
      __vitest_mocked_3__ as name4,
    }
    "
  `)
})
