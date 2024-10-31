import type { HoistMocksPluginOptions } from '../../../packages/mocker/src/node/hoistMocksPlugin'
import { stripVTControlCharacters } from 'node:util'
import { parseAst } from 'rollup/parseAst'
import { describe, expect, it, test } from 'vitest'
import { generateCodeFrame } from 'vitest/src/node/error.js'
import { hoistMocks } from '../../../packages/mocker/src/node/hoistMocksPlugin'

function parse(code: string, options: any) {
  return parseAst(code, options)
}

const hoistMocksOptions: HoistMocksPluginOptions = {
  codeFrameGenerator(node: any, id: string, code: string) {
    return generateCodeFrame(
      code,
      4,
      node.start + 1,
    )
  },
}

function hoistSimple(code: string, url = '') {
  return hoistMocks(code, url, parse, hoistMocksOptions)
}

function hoistSimpleCode(code: string) {
  return hoistMocks(code, '/test.js', parse, hoistMocksOptions)?.code.trim()
}

test('hoists mock, unmock, hoisted', () => {
  expect(hoistSimpleCode(`
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  `)).toMatchInlineSnapshot(`
    "import { vi } from "vitest"
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
    "vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})

    import { vi } from 'vitest'
    import { test } from 'vitest'"
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
    "vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})
    const __vi_import_0__ = await import("./path.js");
    const __vi_import_1__ = await import("./path2.js");

      import { vi } from 'vitest'
      
      
            import { test } from 'vitest'"
  `)
})

test('correctly mocks namespaced', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  import add, * as AddModule from '../src/add'
  vi.mock('../src/add', () => {})
  `)).toMatchInlineSnapshot(`
    "vi.mock('../src/add', () => {})
    const __vi_import_0__ = await import("../src/add");

      import { vi } from 'vitest'"
  `)
})

test('correctly access import', () => {
  expect(hoistSimpleCode(`
  import { vi } from 'vitest'
  import add from '../src/add'
  add();
  vi.mock('../src/add', () => {})
  `)).toMatchInlineSnapshot(`
    "vi.mock('../src/add', () => {})
    const __vi_import_0__ = await import("../src/add");

      import { vi } from 'vitest'
      
      __vi_import_0__.default();"
  `)
})

describe('transform', () => {
  const hoistSimpleCodeWithoutMocks = (code: string) => {
    return hoistMocks(`import {vi} from "vitest";\n${code}\nvi.mock('faker');\n`, '/test.js', parse, hoistMocksOptions)?.code.trim()
  }
  test('default import', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`import foo from 'vue';console.log(foo.bar)`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
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
`, './test.js', parse, hoistMocksOptions)?.code.trim(),
    ).toMatchInlineSnapshot(`
      "vi.mock('./mock.js', () => ({
        getSession: vi.fn().mockImplementation(() => ({
          user: __vi_import_0__.default,
          admin: __vi_import_1__.admin,
        }))
      }))
      const __vi_import_0__ = await import("./user");
      const __vi_import_1__ = await import("./admin");

      import { vi } from 'vitest'"
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
`, './test.js', parse, hoistMocksOptions)?.code.trim(),
    ).toMatchInlineSnapshot(`
      "const { user, admin } = await vi.hoisted(async () => {
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

      import { vi } from 'vitest'"
    `)
  })

  test('named import', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `import { ref } from 'vue';function foo() { return ref(0) }`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function foo() { return __vi_import_0__.ref(0) }"
    `)
  })

  test('namespace import', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `import * as vue from 'vue';function foo() { return vue.ref(0) }`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function foo() { return __vi_import_0__.ref(0) }"
    `)
  })

  test('export function declaration', () => {
    expect(hoistSimpleCodeWithoutMocks(`export function foo() {}`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export function foo() {}"
      `)
  })

  test('export class declaration', () => {
    expect(hoistSimpleCodeWithoutMocks(`export class foo {}`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export class foo {}"
      `)
  })

  test('export var declaration', () => {
    expect(hoistSimpleCodeWithoutMocks(`export const a = 1, b = 2`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export const a = 1, b = 2"
      `)
  })

  test('export named', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`const a = 1, b = 2; export { a, b as c }`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      const a = 1, b = 2; export { a, b as c }"
    `)
  })

  test('export named from', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`export { ref, computed as c } from 'vue'`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export { ref, computed as c } from 'vue'"
    `)
  })

  test('named exports of imported binding', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `import {createApp} from 'vue';export {createApp}`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      export {createApp}"
    `)
  })

  test('export * from', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `export * from 'vue'\n` + `export * from 'react'`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export * from 'vue'
      export * from 'react'"
    `)
  })

  test('export * as from', () => {
    expect(hoistSimpleCodeWithoutMocks(`export * as foo from 'vue'`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export * as foo from 'vue'"
      `)
  })

  test('export default', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`export default {}`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export default {}"
    `)
  })

  test('export then import minified', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `export * from 'vue';import {createApp} from 'vue';`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      export * from 'vue';"
    `)
  })

  test('hoist import to top', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `path.resolve('server.js');import path from 'node:path';`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("node:path");
      import {vi} from "vitest";
      __vi_import_0__.default.resolve('server.js');"
    `)
  })

  test('import.meta', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`console.log(import.meta.url)`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      console.log(import.meta.url)"
    `)
  })

  test('dynamic import', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `export const i = () => import('./foo')`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export const i = () => import('./foo')"
    `)
  })

  test('do not rewrite method definition', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';class A { fn() { fn() } }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      class A { fn() { __vi_import_0__.fn() } }"
    `)
  })

  test('do not rewrite when variable is in scope', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A(){ const fn = () => {}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A(){ const fn = () => {}; return { fn }; }"
    `)
  })

  // #5472
  test('do not rewrite when variable is in scope with object destructuring', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A(){ let {fn, test} = {fn: 'foo', test: 'bar'}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A(){ let {fn, test} = {fn: 'foo', test: 'bar'}; return { fn }; }"
    `)
  })

  // #5472
  test('do not rewrite when variable is in scope with array destructuring', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A(){ let [fn, test] = ['foo', 'bar']; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A(){ let [fn, test] = ['foo', 'bar']; return { fn }; }"
    `)
  })

  // #5727
  test('rewrite variable in string interpolation in function nested arguments', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A({foo = \`test\${fn}\`} = {}){ return {}; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A({foo = \`test\${__vi_import_0__.fn}\`} = {}){ return {}; }"
    `)
  })

  // #6520
  test('rewrite variables in default value of destructuring params', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A({foo = fn}){ return {}; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A({foo = __vi_import_0__.fn}){ return {}; }"
    `)
  })

  test('do not rewrite when function declaration is in scope', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import { fn } from 'vue';function A(){ function fn() {}; return { fn }; }`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      function A(){ function fn() {}; return { fn }; }"
    `)
  })

  test('do not rewrite catch clause', () => {
    const result = hoistSimpleCodeWithoutMocks(
      `import {error} from './dependency';try {} catch(error) {}`,
    )
    expect(result).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("./dependency");
      import {vi} from "vitest";
      try {} catch(error) {}"
    `)
  })

  // #2221
  test('should declare variable for imported super class', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `import { Foo } from './dependency';` + `class A extends Foo {}`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("./dependency");
      import {vi} from "vitest";
      const Foo = __vi_import_0__.Foo;
      class A extends Foo {}"
    `)

    // exported classes: should prepend the declaration at root level, before the
    // first class that uses the binding
    expect(
      hoistSimpleCodeWithoutMocks(
        `import { Foo } from './dependency';`
        + `export default class A extends Foo {}\n`
        + `export class B extends Foo {}`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("./dependency");
      import {vi} from "vitest";
      const Foo = __vi_import_0__.Foo;
      export default class A extends Foo {}
      export class B extends Foo {}"
    `)
  })

  // #4049
  test('should handle default export variants', () => {
  // default anonymous functions
    expect(hoistSimpleCodeWithoutMocks(`export default function() {}\n`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export default function() {}"
      `)
    // default anonymous class
    expect(hoistSimpleCodeWithoutMocks(`export default class {}\n`))
      .toMatchInlineSnapshot(`
        "vi.mock('faker');
        import {vi} from "vitest";
        export default class {}"
      `)
    // default named functions
    expect(
      hoistSimpleCodeWithoutMocks(
        `export default function foo() {}\n`
        + `foo.prototype = Object.prototype;`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export default function foo() {}
      foo.prototype = Object.prototype;"
    `)
    // default named classes
    expect(
      hoistSimpleCodeWithoutMocks(
        `export default class A {}\n` + `export class B extends A {}`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export default class A {}
      export class B extends A {}"
    `)
  })

  test('sourcemap source', () => {
    const map = (
      (hoistSimple(
        `vi.mock(any);
      export const a = 1`,
        'input.js',
      ))?.map
    )
    expect(map?.sources).toStrictEqual(['input.js'])
  })

  test('overwrite bindings', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";
      const a = { inject: __vi_import_0__.inject }
      const b = { test: __vi_import_0__.inject }
      function c() { const { test: inject } = { test: true }; console.log(inject) }
      const d = __vi_import_0__.inject
      function f() {  console.log(__vi_import_0__.inject) }
      function e() { const { inject } = { inject: true } }
      function g() { const f = () => { const inject = true }; console.log(__vi_import_0__.inject) }"
    `)
  })

  test('Empty array pattern', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`const [, LHS, RHS] = inMatch;`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      const [, LHS, RHS] = inMatch;"
    `)
  })

  test('function argument destructure', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `
import { foo, bar } from 'foo'
const a = ({ _ = foo() }) => {}
function b({ _ = bar() }) {}
function c({ _ = bar() + foo() }) {}
`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("foo");
      import {vi} from "vitest";


      const a = ({ _ = __vi_import_0__.foo() }) => {}
      function b({ _ = __vi_import_0__.bar() }) {}
      function c({ _ = __vi_import_0__.bar() + __vi_import_0__.foo() }) {}"
    `)
  })

  test('object destructure alias', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `
import { n } from 'foo'
const a = () => {
  const { type: n = 'bar' } = {}
  console.log(n)
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("foo");
      import {vi} from "vitest";


      const a = () => {
        const { type: n = 'bar' } = {}
        console.log(n)
      }"
    `)

    // #9585
    expect(
      hoistSimpleCodeWithoutMocks(
        `
import { n, m } from 'foo'
const foo = {}

{
  const { [n]: m } = foo
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("foo");
      import {vi} from "vitest";


      const foo = {}

      {
        const { [__vi_import_0__.n]: m } = foo
      }"
    `)
  })

  test('nested object destructure alias', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";



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

  test('object props and methods', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("foo");
      import {vi} from "vitest";



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

  test('class props', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `
import { remove, add } from 'vue'

class A {
  remove = 1
  add = null
}
`,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";



      const add = __vi_import_0__.add;
      const remove = __vi_import_0__.remove;
      class A {
        remove = 1
        add = null
      }"
    `)
  })

  test('class methods', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("foo");
      import {vi} from "vitest";



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

  test('declare scope', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("vue");
      import {vi} from "vitest";



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

  test('continuous exports', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `
export function fn1() {
}export function fn2() {
}
        `,
      ),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";

      export function fn1() {
      }export function fn2() {
      }"
    `)
  })

  // https://github.com/vitest-dev/vitest/issues/1141
  test('export default expression', () => {
  // esbuild transform result of following TS code
  // export default <MyFn> function getRandom() {
  //   return Math.random()
  // }
    const code = `
export default (function getRandom() {
  return Math.random();
});
`.trim()

    expect(hoistSimpleCodeWithoutMocks(code)).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export default (function getRandom() {
        return Math.random();
      });"
    `)

    expect(
      hoistSimpleCodeWithoutMocks(`export default (class A {});`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      import {vi} from "vitest";
      export default (class A {});"
    `)
  })

  // #8002
  test('with hashbang', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `#!/usr/bin/env node
console.log("it can parse the hashbang")`,
      ),
    ).toMatchInlineSnapshot(`undefined`)
  })

  test('import hoisted after hashbang', () => {
    expect(
      hoistSimpleCodeWithoutMocks(
        `#!/usr/bin/env node
console.log(foo);
import foo from "foo"`,
      ),
    ).toMatchInlineSnapshot(`undefined`)
  })

  // #10289
  test('track scope by class, function, condition blocks', () => {
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

    expect(hoistSimpleCodeWithoutMocks(code)).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("foobar");
      import {vi} from "vitest";

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
  test('track var scope by function', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`
import { foo, bar } from 'foobar'
function test() {
  if (true) {
    var foo = () => { var why = 'would' }, bar = 'someone'
  }
  return [foo, bar]
}`),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("foobar");
      import {vi} from "vitest";


      function test() {
        if (true) {
          var foo = () => { var why = 'would' }, bar = 'someone'
        }
        return [foo, bar]
      }"
    `)
  })

  // #11806
  test('track scope by blocks', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("foobar");
      import {vi} from "vitest";


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

  test('track scope in for loops', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("./test.js");
      import {vi} from "vitest";



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

  test('avoid binding ClassExpression', () => {
    const result = hoistSimpleCodeWithoutMocks(
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
      "vi.mock('faker');
      const __vi_import_0__ = await import("./foo");
      import {vi} from "vitest";



      console.log(__vi_import_0__.default, __vi_import_0__.Bar);
      const obj = {
        foo: class Foo {},
        bar: class Bar {}
      }
      const Baz = class extends __vi_import_0__.default {}"
    `)
  })

  test('import assertion attribute', () => {
    expect(
      hoistSimpleCodeWithoutMocks(`
  import * as foo from './foo.json' with { type: 'json' };
  import('./bar.json', { with: { type: 'json' } });
  `),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("./foo.json");
      import {vi} from "vitest";

        
        import('./bar.json', { with: { type: 'json' } });"
    `)
  })

  test('import and export ordering', () => {
  // Given all imported modules logs `mod ${mod}` on execution,
  // and `foo` is `bar`, the logging order should be:
  // "mod a", "mod foo", "mod b", "bar1", "bar2"
    expect(
      hoistSimpleCodeWithoutMocks(`
console.log(foo + 1)
export * from './a'
import { foo } from './foo'
export * from './b'
console.log(foo + 2)
  `),
    ).toMatchInlineSnapshot(`
      "vi.mock('faker');
      const __vi_import_0__ = await import("./foo");
      import {vi} from "vitest";

      console.log(__vi_import_0__.foo + 1)
      export * from './a'

      export * from './b'
      console.log(__vi_import_0__.foo + 2)"
    `)
  })

  test('handle single "await vi.hoisted"', () => {
    expect(
      hoistSimpleCode(`
import { vi } from 'vitest';
1234;
await vi
  .hoisted(() => {});
    `),
    ).toMatchInlineSnapshot(`
      "await vi
        .hoisted(() => {});

      import { vi } from 'vitest';
      1234;"
    `)
  })

  test('handles dynamic import as the first argument', () => {
    expect(
      hoistSimpleCode(`
    vi.mock(import('./path'))
    vi.mock(import(somePath))
    vi.mock(import(\`./path\`))

    vi.mock(import('./path'));
    vi.mock(import(somePath));
    vi.mock(import(\`./path\`));

    vi.mock(await import('./path'))
    vi.mock(await import(somePath))
    vi.mock(await import(\`./path\`))

    vi.mock(await import('./path'));
    vi.mock(await import(somePath));
    vi.mock(await import(\`./path\`));

    vi.mock(import('./path'), () => {})
    vi.mock(import(somePath), () => {})
    vi.mock(import(\`./path\`), () => {})

    vi.mock(await import('./path'), () => {})
    vi.mock(await import(somePath), () => {})
    vi.mock(await import(\`./path\`), () => {})

    vi.mock(import('./path'), () => {});
    vi.mock(import(somePath), () => {});
    vi.mock(import(\`./path\`), () => {});

    vi.mock(await import('./path'), () => {});
    vi.mock(await import(somePath), () => {});
    vi.mock(await import(\`./path\`), () => {});
    `),
    ).toMatchInlineSnapshot(`
      "import { vi } from "vitest"
      vi.mock('./path')
      vi.mock(somePath)
      vi.mock(\`./path\`)
      vi.mock('./path');
      vi.mock(somePath);
      vi.mock(\`./path\`);
      vi.mock('./path')
      vi.mock(somePath)
      vi.mock(\`./path\`)
      vi.mock('./path');
      vi.mock(somePath);
      vi.mock(\`./path\`);
      vi.mock('./path', () => {})
      vi.mock(somePath, () => {})
      vi.mock(\`./path\`, () => {})
      vi.mock('./path', () => {})
      vi.mock(somePath, () => {})
      vi.mock(\`./path\`, () => {})
      vi.mock('./path', () => {});
      vi.mock(somePath, () => {});
      vi.mock(\`./path\`, () => {});
      vi.mock('./path', () => {});
      vi.mock(somePath, () => {});
      vi.mock(\`./path\`, () => {});"
    `)
  })

  test('handles import in vi.do* methods', () => {
    expect(
      hoistSimpleCode(`
vi.doMock(import('./path'))
vi.doMock(import(\`./path\`))
vi.doMock(import('./path'));

beforeEach(() => {
  vi.doUnmock(import('./path'))
  vi.doMock(import('./path'))
})

test('test', async () => {
  vi.doMock(import(dynamicName))
  await import(dynamicName)
})
      `),
    ).toMatchInlineSnapshot(`
      "vi.doMock('./path')
      vi.doMock(\`./path\`)
      vi.doMock('./path');

      beforeEach(() => {
        vi.doUnmock('./path')
        vi.doMock('./path')
      })

      test('test', async () => {
        vi.doMock(dynamicName)
        await import(dynamicName)
      })"
    `)
  })

  test('correctly hoists when import.meta is used', () => {
    expect(hoistSimpleCode(`
import { calc } from './calc'
function sum(a, b) {
  return calc("+", 1, 2);
}

if (import.meta.vitest) {
  const { vi, test, expect } = import.meta.vitest
  vi.mock('faker')
  test('sum', () => {
    expect(sum(1, 2)).toBe(3)
  })
}
      `)).toMatchInlineSnapshot(`
        "import { vi } from "vitest"
        vi.mock('faker')
        const __vi_import_0__ = await import("./calc");


        function sum(a, b) {
          return __vi_import_0__.calc("+", 1, 2);
        }

        if (import.meta.vitest) {
          const { vi, test, expect } = import.meta.vitest
            test('sum', () => {
            expect(sum(1, 2)).toBe(3)
          })
        }"
      `)
  })

  test('injects an error if a utility import is imported from an external module', () => {
    expect(hoistSimpleCode(`
import { expect, test, vi } from './proxy-module'
vi.mock('vite')
test('hi', () => {
  expect(1 + 1).toEqual(2)
})
      `)).toMatchInlineSnapshot(`
        "if (typeof globalThis["vi"] === "undefined") { throw new Error("There are some problems in resolving the mocks API.\\nYou may encounter this issue when importing the mocks API from another module other than 'vitest'.\\nTo fix this issue you can either:\\n- import the mocks API directly from 'vitest'\\n- enable the 'globals' options") }
        __vi_import_0__.vi.mock('vite')
        const __vi_import_0__ = await import("./proxy-module");


        __vi_import_0__.test('hi', () => {
          __vi_import_0__.expect(1 + 1).toEqual(2)
        })"
      `)
  })
})

describe('throws an error when nodes are incompatible', () => {
  const getErrorWhileHoisting = (code: string) => {
    try {
      hoistMocks(code, '/test.js', parse, hoistMocksOptions)?.code.trim()
    }
    catch (err: any) {
      return err
    }
  }

  it.each([
    [
      'vi.hoisted is called inside vi.mock',
      `\
import { vi } from 'vitest'

vi.mock('./mocked', () => {
  const variable = vi.hoisted(() => 1)
  console.log(variable)
})
`,
    ],
    [
      'awaited vi.hoisted is called inside vi.mock',
      `\
import { vi } from 'vitest'

vi.mock('./mocked', async () => {
  await vi.hoisted(() => 1)
})
`,
    ],
    [
      'awaited assigned vi.hoisted is called inside vi.mock',
      `\
import { vi } from 'vitest'

vi.mock('./mocked', async () => {
  const variable = await vi.hoisted(() => 1)
})
`,
    ],
    [
      'vi.mock inside vi.hoisted',
      `\
import { vi } from 'vitest'

vi.hoisted(() => {
  vi.mock('./mocked')
})
`,
    ],
    [
      'vi.mock is called inside assigned vi.hoisted',
      `\
import { vi } from 'vitest'

const values = vi.hoisted(() => {
  vi.mock('./mocked')
})
`,
    ],
    [
      'vi.mock is called inside awaited vi.hoisted',
      `\
import { vi } from 'vitest'

await vi.hoisted(async () => {
  vi.mock('./mocked')
})
`,
    ],
    [
      'vi.mock is called inside assigned awaited vi.hoisted',
      `\
import { vi } from 'vitest'

const values = await vi.hoisted(async () => {
  vi.mock('./mocked')
})
`,
    ],
    [
      'vi.hoisted is exported as a named export',
      `\
import { vi } from 'vitest'

export const values = vi.hoisted(async () => {
  return {}
})
`,
    ],
    [
      'vi.hoisted is exported as default',
      `\
import { vi } from 'vitest'

export default vi.hoisted(() => {
  return {}
})
`,
    ],
    [
      'awaited vi.hoisted is exported as named export',
      `\
import { vi } from 'vitest'

export const values = await vi.hoisted(async () => {
  return {}
})
`,
    ],
    [
      'awaited vi.hoisted is exported as default export',
      `\
import { vi } from 'vitest'

export default await vi.hoisted(async () => {
  return {}
})
`,
    ],
    [
      'vi.mock is exported as default export',
      `\
import { vi } from 'vitest'

export default vi.mock('./mocked')
`,
    ],
    [
      'vi.unmock is exported as default export',
      `\
import { vi } from 'vitest'

export default vi.unmock('./mocked')
`,
    ],
    [
      'vi.mock is exported as a named export',
      `\
import { vi } from 'vitest'

export const mocked = vi.mock('./mocked')
`,
    ],
    [
      'vi.unmock is exported as a named export',
      `\
import { vi } from 'vitest'

export const mocked = vi.unmock('./mocked')
`,
    ],
  ])('correctly throws an error if %s', (_, code) => {
    const error = getErrorWhileHoisting(code)
    expect(error.message).toMatchSnapshot()
    expect(stripVTControlCharacters(error.frame)).toMatchSnapshot()
  })
})
