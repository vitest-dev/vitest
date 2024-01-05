import { parseAst } from 'rollup/parseAst'
import { expect, test } from 'vitest'
import { describe } from 'node:test'
import { hoistMocks } from '../../../packages/vitest/src/node/hoistMocks'

function parse(code: string, options: any) {
  return parseAst(code, options)
}

async function hoistSimple(code: string, url = '') {
  return hoistMocks(code, url, parse)
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
    const __vi_import_0__ = await import('./path.js')
    const __vi_import_1__ = await import('./path2.js')"
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
    const __vi_import_0__ = await import('../src/add')"
  `)
})

test('correctly access import', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  import add from '../src/add'
  add();
  vi.mock('../src/add', () => {})
  `)).toMatchInlineSnapshot(`
    "const { vi } = await import('vitest')
    vi.mock('../src/add', () => {})
    const __vi_import_0__ = await import('../src/add')

      
      
      __vi_import_0__.default();"
  `)
})

describe('transform', () => {
  const hoistSimpleCodeWithoutMocks = (code: string) => {
    return hoistMocks(`import {vi} from "vitest";\n${code}\nvi.mock('faker');`, '/test.js', parse)?.code.trim()
  }
  test('default import', async () => {
    expect(
      hoistSimpleCodeWithoutMocks(`import foo from 'vue';console.log(foo.bar)`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      console.log(__vi_import_0__.default.bar)"
    `)
  })

  test('can use imported variables inside the mock', () => {
    expect(
      hoistMocks(`
import { vi } from 'vitest'
import user from './user'
import { admin } from './admin'
vi.mock('./mock.js', () => ({
  getSession: vi.fn().mockImplementation(() => ({
    user,
    admin: admin,
  }))
}))
`, './test.js', parse)?.code.trim(),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('./mock.js', () => ({
        getSession: vi.fn().mockImplementation(() => ({
          user: __vi_import_0__.default,
          admin: __vi_import_1__.admin,
        }))
      }))
      const __vi_import_0__ = await import('./user')
      const __vi_import_1__ = await import('./admin')"
    `)
  })

  test('can use hoisted variables inside the mock', () => {
    expect(
      hoistMocks(`
import { vi } from 'vitest'
const { user, admin } = await vi.hoisted(async () => {
  const { default: user } = await import('./user')
  const { admin } = await import('./admin')
  return { user, admin }
})
vi.mock('./mock.js', () => {
  getSession: vi.fn().mockImplementation(() => ({
    user,
    admin: admin,
  }))
})
`, './test.js', parse)?.code.trim(),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      const { user, admin } = await vi.hoisted(async () => {
        const { default: user } = await import('./user')
        const { admin } = await import('./admin')
        return { user, admin }
      })
      vi.mock('./mock.js', () => {
        getSession: vi.fn().mockImplementation(() => ({
          user,
          admin: admin,
        }))
      })"
    `)
  })

  test('named import', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import { ref } from 'vue';function foo() { return ref(0) }`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function foo() { return __vi_import_0__.ref(0) }"
    `)
  })

  test('namespace import', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import * as vue from 'vue';function foo() { return vue.ref(0) }`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function foo() { return __vi_import_0__.ref(0) }"
    `)
  })

  test('export function declaration', async () => {
    expect(await hoistSimpleCodeWithoutMocks(`export function foo() {}`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export function foo() {}"
      `)
  })

  test('export class declaration', async () => {
    expect(await hoistSimpleCodeWithoutMocks(`export class foo {}`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export class foo {}"
      `)
  })

  test('export var declaration', async () => {
    expect(await hoistSimpleCodeWithoutMocks(`export const a = 1, b = 2`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export const a = 1, b = 2"
      `)
  })

  test('export named', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`const a = 1, b = 2; export { a, b as c }`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      const a = 1, b = 2; export { a, b as c }"
    `)
  })

  test('export named from', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`export { ref, computed as c } from 'vue'`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export { ref, computed as c } from 'vue'"
    `)
  })

  test('named exports of imported binding', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import {createApp} from 'vue';export {createApp}`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      export {createApp}"
    `)
  })

  test('export * from', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `export * from 'vue'\n` + `export * from 'react'`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export * from 'vue'
      export * from 'react'"
    `)
  })

  test('export * as from', async () => {
    expect(await hoistSimpleCodeWithoutMocks(`export * as foo from 'vue'`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export * as foo from 'vue'"
      `)
  })

  test('export default', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`export default {}`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export default {}"
    `)
  })

  test('export then import minified', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `export * from 'vue';import {createApp} from 'vue';`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      export * from 'vue';"
    `)
  })

  test('hoist import to top', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `path.resolve('server.js');import path from 'node:path';`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('node:path')

      __vi_import_0__.default.resolve('server.js');"
    `)
  })

  test('import.meta', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`console.log(import.meta.url)`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      console.log(import.meta.url)"
    `)
  })

  test('dynamic import', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `export const i = () => import('./foo')`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export const i = () => import('./foo')"
    `)
  })

  test('do not rewrite method definition', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';class A { fn() { fn() } }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      class A { fn() { __vi_import_0__.fn() } }"
    `)
  })

  test('do not rewrite when variable is in scope', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A(){ const fn = () => {}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A(){ const fn = () => {}; return { fn }; }"
    `)
  })

  // #5472
  test('do not rewrite when variable is in scope with object destructuring', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A(){ let {fn, test} = {fn: 'foo', test: 'bar'}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A(){ let {fn, test} = {fn: 'foo', test: 'bar'}; return { fn }; }"
    `)
  })

  // #5472
  test('do not rewrite when variable is in scope with array destructuring', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A(){ let [fn, test] = ['foo', 'bar']; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A(){ let [fn, test] = ['foo', 'bar']; return { fn }; }"
    `)
  })

  // #5727
  test('rewrite variable in string interpolation in function nested arguments', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A({foo = \`test\${fn}\`} = {}){ return {}; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A({foo = \`test\${__vi_import_0__.fn}\`} = {}){ return {}; }"
    `)
  })

  // #6520
  test('rewrite variables in default value of destructuring params', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A({foo = fn}){ return {}; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A({foo = __vi_import_0__.fn}){ return {}; }"
    `)
  })

  test('do not rewrite when function declaration is in scope', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import { fn } from 'vue';function A(){ function fn() {}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      function A(){ function fn() {}; return { fn }; }"
    `)
  })

  test('do not rewrite catch clause', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `import {error} from './dependency';try {} catch(error) {}`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./dependency')

      try {} catch(error) {}"
    `)
  })

  // #2221
  test('should declare variable for imported super class', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import { Foo } from './dependency';` + `class A extends Foo {}`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./dependency')

      const Foo = __vi_import_0__.Foo;
      class A extends Foo {}"
    `)

    // exported classes: should prepend the declaration at root level, before the
    // first class that uses the binding
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import { Foo } from './dependency';`
        + `export default class A extends Foo {}\n`
        + `export class B extends Foo {}`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./dependency')

      const Foo = __vi_import_0__.Foo;
      export default class A extends Foo {}
      export class B extends Foo {}"
    `)
  })

  // #4049
  test('should handle default export variants', async () => {
  // default anonymous functions
    expect(await hoistSimpleCodeWithoutMocks(`export default function() {}\n`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export default function() {}"
      `)
    // default anonymous class
    expect(await hoistSimpleCodeWithoutMocks(`export default class {}\n`))
      .toMatchInlineSnapshot(`
        "const { vi } = await import('vitest')
        vi.mock('faker');

        export default class {}"
      `)
    // default named functions
    expect(
      await hoistSimpleCodeWithoutMocks(
      `export default function foo() {}\n`
        + `foo.prototype = Object.prototype;`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export default function foo() {}
      foo.prototype = Object.prototype;"
    `)
    // default named classes
    expect(
      await hoistSimpleCodeWithoutMocks(
      `export default class A {}\n` + `export class B extends A {}`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export default class A {}
      export class B extends A {}"
    `)
  })

  test('sourcemap source', async () => {
    const map = (
      (await hoistSimple(
      `vi.mock(any);
      export const a = 1`,
      'input.js',
      ))?.map
    )
    expect(map?.sources).toStrictEqual(['input.js'])
  })

  test('overwrite bindings', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `import { inject } from 'vue';`
        + `const a = { inject }\n`
        + `const b = { test: inject }\n`
        + `function c() { const { test: inject } = { test: true }; console.log(inject) }\n`
        + `const d = inject\n`
        + `function f() {  console.log(inject) }\n`
        + `function e() { const { inject } = { inject: true } }\n`
        + `function g() { const f = () => { const inject = true }; console.log(inject) }\n`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')

      const a = { inject: __vi_import_0__.inject }
      const b = { test: __vi_import_0__.inject }
      function c() { const { test: inject } = { test: true }; console.log(inject) }
      const d = __vi_import_0__.inject
      function f() {  console.log(__vi_import_0__.inject) }
      function e() { const { inject } = { inject: true } }
      function g() { const f = () => { const inject = true }; console.log(__vi_import_0__.inject) }"
    `)
  })

  test('Empty array pattern', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`const [, LHS, RHS] = inMatch;`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      const [, LHS, RHS] = inMatch;"
    `)
  })

  test('function argument destructure', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { foo, bar } from 'foo'
const a = ({ _ = foo() }) => {}
function b({ _ = bar() }) {}
function c({ _ = bar() + foo() }) {}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foo')



      const a = ({ _ = __vi_import_0__.foo() }) => {}
      function b({ _ = __vi_import_0__.bar() }) {}
      function c({ _ = __vi_import_0__.bar() + __vi_import_0__.foo() }) {}"
    `)
  })

  test('object destructure alias', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { n } from 'foo'
const a = () => {
  const { type: n = 'bar' } = {}
  console.log(n)
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foo')



      const a = () => {
        const { type: n = 'bar' } = {}
        console.log(n)
      }"
    `)

    // #9585
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { n, m } from 'foo'
const foo = {}

{
  const { [n]: m } = foo
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foo')



      const foo = {}

      {
        const { [__vi_import_0__.n]: m } = foo
      }"
    `)
  })

  test('nested object destructure alias', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { remove, add, get, set, rest, objRest } from 'vue'

function a() {
  const {
    o: { remove },
    a: { b: { c: [ add ] }},
    d: [{ get }, set, ...rest],
    ...objRest
  } = foo

  remove()
  add()
  get()
  set()
  rest()
  objRest()
}

remove()
add()
get()
set()
rest()
objRest()
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')



      function a() {
        const {
          o: { remove },
          a: { b: { c: [ add ] }},
          d: [{ get }, set, ...rest],
          ...objRest
        } = foo

        remove()
        add()
        get()
        set()
        rest()
        objRest()
      }

      __vi_import_0__.remove()
      __vi_import_0__.add()
      __vi_import_0__.get()
      __vi_import_0__.set()
      __vi_import_0__.rest()
      __vi_import_0__.objRest()"
    `)
  })

  test('object props and methods', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import foo from 'foo'

const bar = 'bar'

const obj = {
  foo() {},
  [foo]() {},
  [bar]() {},
  foo: () => {},
  [foo]: () => {},
  [bar]: () => {},
  bar(foo) {}
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foo')



      const bar = 'bar'

      const obj = {
        foo() {},
        [__vi_import_0__.default]() {},
        [bar]() {},
        foo: () => {},
        [__vi_import_0__.default]: () => {},
        [bar]: () => {},
        bar(foo) {}
      }"
    `)
  })

  test('class props', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { remove, add } from 'vue'

class A {
  remove = 1
  add = null
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')



      const add = __vi_import_0__.add;
      const remove = __vi_import_0__.remove;
      class A {
        remove = 1
        add = null
      }"
    `)
  })

  test('class methods', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import foo from 'foo'

const bar = 'bar'

class A {
  foo() {}
  [foo]() {}
  [bar]() {}
  #foo() {}
  bar(foo) {}
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foo')



      const bar = 'bar'

      class A {
        foo() {}
        [__vi_import_0__.default]() {}
        [bar]() {}
        #foo() {}
        bar(foo) {}
      }"
    `)
  })

  test('declare scope', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
import { aaa, bbb, ccc, ddd } from 'vue'

function foobar() {
  ddd()

  const aaa = () => {
    bbb(ccc)
    ddd()
  }
  const bbb = () => {
    console.log('hi')
  }
  const ccc = 1
  function ddd() {}

  aaa()
  bbb()
  ccc()
}

aaa()
bbb()
`,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('vue')



      function foobar() {
        ddd()

        const aaa = () => {
          bbb(ccc)
          ddd()
        }
        const bbb = () => {
          console.log('hi')
        }
        const ccc = 1
        function ddd() {}

        aaa()
        bbb()
        ccc()
      }

      __vi_import_0__.aaa()
      __vi_import_0__.bbb()"
    `)
  })

  test('continuous exports', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `
export function fn1() {
}export function fn2() {
}
        `,
      ),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');


      export function fn1() {
      }export function fn2() {
      }"
    `)
  })

  // https://github.com/vitest-dev/vitest/issues/1141
  test('export default expression', async () => {
  // esbuild transform result of following TS code
  // export default <MyFn> function getRandom() {
  //   return Math.random()
  // }
    const code = `
export default (function getRandom() {
  return Math.random();
});
`.trim()

    expect(await hoistSimpleCodeWithoutMocks(code)).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export default (function getRandom() {
        return Math.random();
      });"
    `)

    expect(
      await hoistSimpleCodeWithoutMocks(`export default (class A {});`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');

      export default (class A {});"
    `)
  })

  // #8002
  test('with hashbang', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `#!/usr/bin/env node
console.log("it can parse the hashbang")`,
      ),
    ).toMatchInlineSnapshot(`undefined`)
  })

  test('import hoisted after hashbang', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(
      `#!/usr/bin/env node
console.log(foo);
import foo from "foo"`,
      ),
    ).toMatchInlineSnapshot(`undefined`)
  })

  // #10289
  test('track scope by class, function, condition blocks', async () => {
    const code = `
import { foo, bar } from 'foobar'
if (false) {
  const foo = 'foo'
  console.log(foo)
} else if (false) {
  const [bar] = ['bar']
  console.log(bar)
} else {
  console.log(foo)
  console.log(bar)
}
export class Test {
  constructor() {
    if (false) {
      const foo = 'foo'
      console.log(foo)
    } else if (false) {
      const [bar] = ['bar']
      console.log(bar)
    } else {
      console.log(foo)
      console.log(bar)
    }
  }
};`.trim()

    expect(await hoistSimpleCodeWithoutMocks(code)).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foobar')


      if (false) {
        const foo = 'foo'
        console.log(foo)
      } else if (false) {
        const [bar] = ['bar']
        console.log(bar)
      } else {
        console.log(__vi_import_0__.foo)
        console.log(__vi_import_0__.bar)
      }
      export class Test {
        constructor() {
          if (false) {
            const foo = 'foo'
            console.log(foo)
          } else if (false) {
            const [bar] = ['bar']
            console.log(bar)
          } else {
            console.log(__vi_import_0__.foo)
            console.log(__vi_import_0__.bar)
          }
        }
      };"
    `)
  })

  // #10386
  test('track var scope by function', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`
import { foo, bar } from 'foobar'
function test() {
  if (true) {
    var foo = () => { var why = 'would' }, bar = 'someone'
  }
  return [foo, bar]
}`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foobar')



      function test() {
        if (true) {
          var foo = () => { var why = 'would' }, bar = 'someone'
        }
        return [foo, bar]
      }"
    `)
  })

  // #11806
  test('track scope by blocks', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`
import { foo, bar, baz } from 'foobar'
function test() {
  [foo];
  {
    let foo = 10;
    let bar = 10;
  }
  try {} catch (baz){ baz };
  return bar;
}`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('foobar')



      function test() {
        [__vi_import_0__.foo];
        {
          let foo = 10;
          let bar = 10;
        }
        try {} catch (baz){ baz };
        return __vi_import_0__.bar;
      }"
    `)
  })

  test('track scope in for loops', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`
import { test } from './test.js'

for (const test of tests) {
  console.log(test)
}

for (let test = 0; test < 10; test++) {
  console.log(test)
}

for (const test in tests) {
  console.log(test)
}`),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./test.js')



      for (const test of tests) {
        console.log(test)
      }

      for (let test = 0; test < 10; test++) {
        console.log(test)
      }

      for (const test in tests) {
        console.log(test)
      }"
    `)
  })

  test('avoid binding ClassExpression', async () => {
    const result = await hoistSimpleCodeWithoutMocks(
    `
import Foo, { Bar } from './foo';

console.log(Foo, Bar);
const obj = {
  foo: class Foo {},
  bar: class Bar {}
}
const Baz = class extends Foo {}
`,
    )
    expect(result).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./foo')



      console.log(__vi_import_0__.default, __vi_import_0__.Bar);
      const obj = {
        foo: class Foo {},
        bar: class Bar {}
      }
      const Baz = class extends __vi_import_0__.default {}"
    `)
  })

  test('import assertion attribute', async () => {
    expect(
      await hoistSimpleCodeWithoutMocks(`
  import * as foo from './foo.json' with { type: 'json' };
  import('./bar.json', { with: { type: 'json' } });
  `),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./foo.json')


        
        import('./bar.json', { with: { type: 'json' } });"
    `)
  })

  test('import and export ordering', async () => {
  // Given all imported modules logs `mod ${mod}` on execution,
  // and `foo` is `bar`, the logging order should be:
  // "mod a", "mod foo", "mod b", "bar1", "bar2"
    expect(
      await hoistSimpleCodeWithoutMocks(`
console.log(foo + 1)
export * from './a'
import { foo } from './foo'
export * from './b'
console.log(foo + 2)
  `),
    ).toMatchInlineSnapshot(`
      "const { vi } = await import('vitest')
      vi.mock('faker');
      const __vi_import_0__ = await import('./foo')


      console.log(__vi_import_0__.foo + 1)
      export * from './a'

      export * from './b'
      console.log(__vi_import_0__.foo + 2)"
    `)
  })
})
