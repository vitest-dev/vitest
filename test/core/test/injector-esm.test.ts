import { parseAst } from 'rollup/parseAst'
import { expect, test } from 'vitest'
import { transformWithEsbuild } from 'vite'
import { injectVitestModule } from '../../../packages/browser/src/node/esmInjector'

function parse(code: string, options: any) {
  return parseAst(code, options)
}

function injectSimpleCode(code: string) {
  return injectVitestModule(code, '/test.js', parse)?.code
}

test('default import', async () => {
  expect(
    injectSimpleCode('import foo from \'vue\';console.log(foo.bar)'),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    console.log(__vi_esm_0__.default.bar)"
  `)
})

test('named import', async () => {
  expect(
    injectSimpleCode(
      'import { ref } from \'vue\';function foo() { return ref(0) }',
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function foo() { return __vi_esm_0__.ref(0) }"
  `)
})

test('namespace import', async () => {
  expect(
    injectSimpleCode(
      'import * as vue from \'vue\';function foo() { return vue.ref(0) }',
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function foo() { return __vi_esm_0__.ref(0) }"
  `)
})

test('export function declaration', async () => {
  expect(injectSimpleCode('export function foo() {}'))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      function foo() {}
      Object.defineProperty(__vi_inject__, "foo", { enumerable: true, configurable: true, get(){ return foo }});
      export { __vi_inject__ }"
    `)
})

test('export class declaration', async () => {
  expect(await injectSimpleCode('export class foo {}'))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      class foo {}
      Object.defineProperty(__vi_inject__, "foo", { enumerable: true, configurable: true, get(){ return foo }});
      export { __vi_inject__ }"
    `)
})

test('export var declaration', async () => {
  expect(await injectSimpleCode('export const a = 1, b = 2'))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      const a = 1, b = 2
      Object.defineProperty(__vi_inject__, "a", { enumerable: true, configurable: true, get(){ return a }});
      Object.defineProperty(__vi_inject__, "b", { enumerable: true, configurable: true, get(){ return b }});
      export { __vi_inject__ }"
    `)
})

test('export named', async () => {
  expect(
    injectSimpleCode('const a = 1, b = 2; export { a, b as c }'),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    const a = 1, b = 2; 
    Object.defineProperty(__vi_inject__, "a", { enumerable: true, configurable: true, get(){ return a }});
    Object.defineProperty(__vi_inject__, "c", { enumerable: true, configurable: true, get(){ return b }});
    export { __vi_inject__ }"
  `)
})

test('export named from', async () => {
  expect(
    injectSimpleCode('export { ref, computed as c } from \'vue\''),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    const { __vi_inject__: __vi_esm_0__ } = await import("vue");

    Object.defineProperty(__vi_inject__, "ref", { enumerable: true, configurable: true, get(){ return __vi_esm_0__.ref }});
    Object.defineProperty(__vi_inject__, "c", { enumerable: true, configurable: true, get(){ return __vi_esm_0__.computed }});
    export { __vi_inject__ }"
  `)
})

test('named exports of imported binding', async () => {
  expect(
    injectSimpleCode(
      'import {createApp} from \'vue\';export {createApp}',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    import { __vi_inject__ as __vi_esm_0__ } from 'vue'

    Object.defineProperty(__vi_inject__, "createApp", { enumerable: true, configurable: true, get(){ return __vi_esm_0__.createApp }});
    export { __vi_inject__ }"
  `)
})

test('export * from', async () => {
  expect(
    injectSimpleCode(
      'export * from \'vue\'\n' + 'export * from \'react\'',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    const { __vi_inject__: __vi_esm_0__ } = await import("vue");
    __vi_export_all__(__vi_inject__, __vi_esm_0__);
    const { __vi_inject__: __vi_esm_1__ } = await import("react");
    __vi_export_all__(__vi_inject__, __vi_esm_1__);


    export { __vi_inject__ }"
  `)
})

test('export * as from', async () => {
  expect(injectSimpleCode('export * as foo from \'vue\''))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      const { __vi_inject__: __vi_esm_0__ } = await import("vue");

      Object.defineProperty(__vi_inject__, "foo", { enumerable: true, configurable: true, get(){ return __vi_esm_0__ }});
      export { __vi_inject__ }"
    `)
})

test('export default', async () => {
  expect(
    injectSimpleCode('export default {}'),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    __vi_inject__.default = {}
    export default { __vi_inject__: __vi_inject__.default };

    export { __vi_inject__ }"
  `)
})

test('export then import minified', async () => {
  expect(
    injectSimpleCode(
      'export * from \'vue\';import {createApp} from \'vue\';',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    const { __vi_inject__: __vi_esm_1__ } = await import("vue");
    __vi_export_all__(__vi_inject__, __vi_esm_1__);

    export { __vi_inject__ }"
  `)
})

test('hoist import to top', async () => {
  expect(
    injectSimpleCode(
      'path.resolve(\'server.js\');import path from \'node:path\';',
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'node:path'
    __vi_esm_0__.default.resolve('server.js');"
  `)
})

// test('import.meta', async () => {
//   expect(
//     injectSimpleCode('console.log(import.meta.url)'),
//   ).toMatchInlineSnapshot('"console.log(__vite_ssr_import_meta__.url)"')
// })

test('dynamic import', async () => {
  const result = injectSimpleCode(
    'export const i = () => import(\'./foo\')',
  )
  expect(result).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    const i = () => __vi_wrap_module__(import('./foo'))
    export { __vi_inject__ }"
  `)
})

test('do not rewrite method definition', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';class A { fn() { fn() } }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    class A { fn() { __vi_esm_0__.fn() } }"
  `)
})

test('do not rewrite when variable is in scope', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';function A(){ const fn = () => {}; return { fn }; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A(){ const fn = () => {}; return { fn }; }"
  `)
})

// #5472
test('do not rewrite when variable is in scope with object destructuring', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';function A(){ let {fn, test} = {fn: \'foo\', test: \'bar\'}; return { fn }; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A(){ let {fn, test} = {fn: 'foo', test: 'bar'}; return { fn }; }"
  `)
})

// #5472
test('do not rewrite when variable is in scope with array destructuring', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';function A(){ let [fn, test] = [\'foo\', \'bar\']; return { fn }; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A(){ let [fn, test] = ['foo', 'bar']; return { fn }; }"
  `)
})

// #5727
test('rewrite variable in string interpolation in function nested arguments', async () => {
  const result = injectSimpleCode(
    // eslint-disable-next-line no-template-curly-in-string
    'import { fn } from \'vue\';function A({foo = `test${fn}`} = {}){ return {}; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A({foo = \`test\${__vi_esm_0__.fn}\`} = {}){ return {}; }"
  `)
})

// #6520
test('rewrite variables in default value of destructuring params', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';function A({foo = fn}){ return {}; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A({foo = __vi_esm_0__.fn}){ return {}; }"
  `)
})

test('do not rewrite when function declaration is in scope', async () => {
  const result = injectSimpleCode(
    'import { fn } from \'vue\';function A(){ function fn() {}; return { fn }; }',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    function A(){ function fn() {}; return { fn }; }"
  `)
})

test('do not rewrite catch clause', async () => {
  const result = injectSimpleCode(
    'import {error} from \'./dependency\';try {} catch(error) {}',
  )
  expect(result).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from './dependency'
    try {} catch(error) {}"
  `)
})

// #2221
test('should declare variable for imported super class', async () => {
  expect(
    injectSimpleCode(
      'import { Foo } from \'./dependency\';' + 'class A extends Foo {}',
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from './dependency'
    const Foo = __vi_esm_0__.Foo;
    class A extends Foo {}"
  `)

  // exported classes: should prepend the declaration at root level, before the
  // first class that uses the binding
  expect(
    injectSimpleCode(
      'import { Foo } from \'./dependency\';'
        + 'export default class A extends Foo {}\n'
        + 'export class B extends Foo {}',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    import { __vi_inject__ as __vi_esm_0__ } from './dependency'
    const Foo = __vi_esm_0__.Foo;
    class A extends Foo {}
    class B extends Foo {}
    Object.defineProperty(__vi_inject__, "B", { enumerable: true, configurable: true, get(){ return B }});
    Object.defineProperty(__vi_inject__, "default", { enumerable: true, configurable: true, value: A });
    export { __vi_inject__ }"
  `)
})

// #4049
test('should handle default export variants', async () => {
  // default anonymous functions
  expect(injectSimpleCode('export default function() {}\n'))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      __vi_inject__.default = function() {}

      export default { __vi_inject__: __vi_inject__.default };

      export { __vi_inject__ }"
    `)
  // default anonymous class
  expect(injectSimpleCode('export default class {}\n'))
    .toMatchInlineSnapshot(`
      "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
      __vi_inject__.default = class {}

      export default { __vi_inject__: __vi_inject__.default };

      export { __vi_inject__ }"
    `)
  // default named functions
  expect(
    injectSimpleCode(
      'export default function foo() {}\n'
        + 'foo.prototype = Object.prototype;',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    function foo() {}
    foo.prototype = Object.prototype;
    Object.defineProperty(__vi_inject__, "default", { enumerable: true, configurable: true, value: foo });
    export { __vi_inject__ }"
  `)
  // default named classes
  expect(
    injectSimpleCode(
      'export default class A {}\n' + 'export class B extends A {}',
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    class A {}
    class B extends A {}
    Object.defineProperty(__vi_inject__, "B", { enumerable: true, configurable: true, get(){ return B }});
    Object.defineProperty(__vi_inject__, "default", { enumerable: true, configurable: true, value: A });
    export { __vi_inject__ }"
  `)
})

test('overwrite bindings', async () => {
  expect(
    injectSimpleCode(
      'import { inject } from \'vue\';'
        + 'const a = { inject }\n'
        + 'const b = { test: inject }\n'
        + 'function c() { const { test: inject } = { test: true }; console.log(inject) }\n'
        + 'const d = inject\n'
        + 'function f() {  console.log(inject) }\n'
        + 'function e() { const { inject } = { inject: true } }\n'
        + 'function g() { const f = () => { const inject = true }; console.log(inject) }\n',
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'
    const a = { inject: __vi_esm_0__.inject }
    const b = { test: __vi_esm_0__.inject }
    function c() { const { test: inject } = { test: true }; console.log(inject) }
    const d = __vi_esm_0__.inject
    function f() {  console.log(__vi_esm_0__.inject) }
    function e() { const { inject } = { inject: true } }
    function g() { const f = () => { const inject = true }; console.log(__vi_esm_0__.inject) }
    "
  `)
})

test('Empty array pattern', async () => {
  expect(
    injectSimpleCode('const [, LHS, RHS] = inMatch;'),
  ).toMatchInlineSnapshot('"const [, LHS, RHS] = inMatch;"')
})

test('function argument destructure', async () => {
  expect(
    injectSimpleCode(
      `
import { foo, bar } from 'foo'
const a = ({ _ = foo() }) => {}
function b({ _ = bar() }) {}
function c({ _ = bar() + foo() }) {}
`,
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'foo'


    const a = ({ _ = __vi_esm_0__.foo() }) => {}
    function b({ _ = __vi_esm_0__.bar() }) {}
    function c({ _ = __vi_esm_0__.bar() + __vi_esm_0__.foo() }) {}
    "
  `)
})

test('object destructure alias', async () => {
  expect(
    injectSimpleCode(
      `
import { n } from 'foo'
const a = () => {
  const { type: n = 'bar' } = {}
  console.log(n)
}
`,
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'foo'


    const a = () => {
      const { type: n = 'bar' } = {}
      console.log(n)
    }
    "
  `)

  // #9585
  expect(
    injectSimpleCode(
      `
import { n, m } from 'foo'
const foo = {}

{
  const { [n]: m } = foo
}
`,
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'foo'


    const foo = {}

    {
      const { [__vi_esm_0__.n]: m } = foo
    }
    "
  `)
})

test('nested object destructure alias', async () => {
  expect(
    injectSimpleCode(
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
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'



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

    __vi_esm_0__.remove()
    __vi_esm_0__.add()
    __vi_esm_0__.get()
    __vi_esm_0__.set()
    __vi_esm_0__.rest()
    __vi_esm_0__.objRest()
    "
  `)
})

test('object props and methods', async () => {
  expect(
    injectSimpleCode(
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
    "import { __vi_inject__ as __vi_esm_0__ } from 'foo'



    const bar = 'bar'

    const obj = {
      foo() {},
      [__vi_esm_0__.default]() {},
      [bar]() {},
      foo: () => {},
      [__vi_esm_0__.default]: () => {},
      [bar]: () => {},
      bar(foo) {}
    }
    "
  `)
})

test('class props', async () => {
  expect(
    injectSimpleCode(
      `
import { remove, add } from 'vue'

class A {
  remove = 1
  add = null
}
`,
    ),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'



    const add = __vi_esm_0__.add;
    const remove = __vi_esm_0__.remove;
    class A {
      remove = 1
      add = null
    }
    "
  `)
})

test('class methods', async () => {
  expect(
    injectSimpleCode(
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
    "import { __vi_inject__ as __vi_esm_0__ } from 'foo'



    const bar = 'bar'

    class A {
      foo() {}
      [__vi_esm_0__.default]() {}
      [bar]() {}
      #foo() {}
      bar(foo) {}
    }
    "
  `)
})

test('declare scope', async () => {
  expect(
    injectSimpleCode(
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
    "import { __vi_inject__ as __vi_esm_0__ } from 'vue'



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

    __vi_esm_0__.aaa()
    __vi_esm_0__.bbb()
    "
  `)
})

test('jsx', async () => {
  const code = `
  import React from 'react'
  import { Foo, Slot } from 'foo'

  function Bar({ Slot = <Foo /> }) {
    return (
      <>
        <Slot />
      </>
    )
  }
  `
  const id = '/foo.jsx'
  const result = await transformWithEsbuild(code, id)
  expect(injectSimpleCode(result.code))
    .toMatchInlineSnapshot(`
      "import { __vi_inject__ as __vi_esm_0__ } from 'react'
      import { __vi_inject__ as __vi_esm_1__ } from 'foo'


      function Bar({ Slot: Slot2 = /* @__PURE__ */ __vi_esm_0__.default.createElement(__vi_esm_1__.Foo, null) }) {
        return /* @__PURE__ */ __vi_esm_0__.default.createElement(__vi_esm_0__.default.Fragment, null, /* @__PURE__ */ __vi_esm_0__.default.createElement(Slot2, null));
      }
      "
    `)
})

test('continuous exports', async () => {
  expect(
    injectSimpleCode(
      `
export function fn1() {
}export function fn2() {
}
        `,
    ),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };

    function fn1() {
    }
    Object.defineProperty(__vi_inject__, "fn1", { enumerable: true, configurable: true, get(){ return fn1 }});function fn2() {
    }
    Object.defineProperty(__vi_inject__, "fn2", { enumerable: true, configurable: true, get(){ return fn2 }});
            
    export { __vi_inject__ }"
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

  expect(injectSimpleCode(code)).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    __vi_inject__.default = (function getRandom() {
      return Math.random();
    });
    export default { __vi_inject__: __vi_inject__.default };

    export { __vi_inject__ }"
  `)

  expect(
    injectSimpleCode('export default (class A {});'),
  ).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    __vi_inject__.default = (class A {});
    export default { __vi_inject__: __vi_inject__.default };

    export { __vi_inject__ }"
  `)
})

test('track scope in for loops', async () => {
  expect(
    injectSimpleCode(`
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
    "import { __vi_inject__ as __vi_esm_0__ } from './test.js'


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

// #8002
// test('with hashbang', async () => {
//   expect(
//     injectSimpleCode(
//       `#!/usr/bin/env node
// console.log("it can parse the hashbang")`,
//     ),
//   ).toMatchInlineSnapshot(`
//     "#!/usr/bin/env node
//     console.log(\\"it can parse the hashbang\\")"
//   `)
// })

// test('import hoisted after hashbang', async () => {
//   expect(
//     await injectSimpleCode(
//       `#!/usr/bin/env node
// import "foo"`,
//     ),
//   ).toMatchInlineSnapshot(`
//     "#!/usr/bin/env node
//     const __vite_ssr_import_0__ = await __vite_ssr_import__(\\"foo\\");
//     "
//   `)
// })

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

  expect(injectSimpleCode(code)).toMatchInlineSnapshot(`
    "const __vi_inject__ = { [Symbol.toStringTag]: "Module" };
    import { __vi_inject__ as __vi_esm_0__ } from 'foobar'

    if (false) {
      const foo = 'foo'
      console.log(foo)
    } else if (false) {
      const [bar] = ['bar']
      console.log(bar)
    } else {
      console.log(__vi_esm_0__.foo)
      console.log(__vi_esm_0__.bar)
    }
    class Test {
      constructor() {
        if (false) {
          const foo = 'foo'
          console.log(foo)
        } else if (false) {
          const [bar] = ['bar']
          console.log(bar)
        } else {
          console.log(__vi_esm_0__.foo)
          console.log(__vi_esm_0__.bar)
        }
      }
    }
    Object.defineProperty(__vi_inject__, "Test", { enumerable: true, configurable: true, get(){ return Test }});;
    export { __vi_inject__ }"
  `)
})

// #10386
test('track var scope by function', async () => {
  expect(
    injectSimpleCode(`
import { foo, bar } from 'foobar'
function test() {
  if (true) {
    var foo = () => { var why = 'would' }, bar = 'someone'
  }
  return [foo, bar]
}`),
  ).toMatchInlineSnapshot(`
    "import { __vi_inject__ as __vi_esm_0__ } from 'foobar'


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
    injectSimpleCode(`
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
    "import { __vi_inject__ as __vi_esm_0__ } from 'foobar'


    function test() {
      [__vi_esm_0__.foo];
      {
        let foo = 10;
        let bar = 10;
      }
      try {} catch (baz){ baz };
      return __vi_esm_0__.bar;
    }"
  `)
})

test('avoid binding ClassExpression', () => {
  const result = injectSimpleCode(
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
    "import { __vi_inject__ as __vi_esm_0__ } from './foo'

     
     console.log(__vi_esm_0__.default, __vi_esm_0__.Bar);
     const obj = {
       foo: class Foo {},
       bar: class Bar {}
     }
     const Baz = class extends __vi_esm_0__.default {}
     "
  `)
})
