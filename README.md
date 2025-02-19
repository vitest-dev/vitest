<p align="center">
<a href="https://vitest.dev">
<img src="https://user-images.githubusercontent.com/11247099/145112184-a9ff6727-661c-439d-9ada-963124a281f7.png" height="150">
</a>
</p>

<h1 align="center">
Vitest
</h1>
<p align="center">
Next generation testing framework powered by Vite.
<p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitest"><img src="https://img.shields.io/npm/v/vitest?color=729B1B&label="></a>
<p>

<p align="center">
<a href="https://chat.vitest.dev"><b>Get involved!</b></a>
</p>
<p align="center">
 <a href="https://vitest.dev">Documentation</a> | <a href="https://vitest.dev/guide/">Getting Started</a> | <a href="https://vitest.dev/guide/#examples">Examples</a> | <a href="https://vitest.dev/guide/why">Why Vitest?</a>
</p>
<p align="center">
<a href="https://cn.vitest.dev">中文文档</a>
</p>

<h4 align="center">

</h4>
<br>
<br>

## Features

- [Vite](https://vitejs.dev/)'s config, transformers, resolvers, and plugins. Use the same setup from your app!
- [Jest Snapshot](https://jestjs.io/docs/snapshot-testing)
- [Chai](https://www.chaijs.com/) built-in for assertions, with [Jest expect](https://jestjs.io/docs/expect) compatible APIs
- [Smart & instant watch mode](https://vitest.dev/guide/features.html#watch-mode), like HMR for tests!
- [Native code coverage](https://vitest.dev/guide/features.html#coverage) via [`v8`](https://v8.dev/blog/javascript-code-coverage) or [`istanbul`](https://istanbul.js.org/).
- [Tinyspy](https://github.com/tinylibs/tinyspy) built-in for mocking, stubbing, and spies.
- [JSDOM](https://github.com/jsdom/jsdom) and [happy-dom](https://github.com/capricorn86/happy-dom) for DOM and browser API mocking
- [Browser Mode](https://vitest.dev/guide/browser/) for running component tests in the browser
- Components testing ([Vue](https://github.com/vitest-tests/browser-examples/tree/main/examples/vue), [React](https://github.com/vitest-tests/browser-examples/tree/main/examples/react), [Svelte](https://github.com/vitest-tests/browser-examples/tree/main/examples/svelte), [Lit](./examples/lit), [Marko](https://github.com/marko-js/examples/tree/master/examples/library-ts))
- Workers multi-threading via [Tinypool](https://github.com/tinylibs/tinypool) (a lightweight fork of [Piscina](https://github.com/piscinajs/piscina))
- Benchmarking support with [Tinybench](https://github.com/tinylibs/tinybench)
- [Workspace](https://vitest.dev/guide/workspace) support
- [expect-type](https://github.com/mmkal/expect-type) for type-level testing
- ESM first, top level await
- Out-of-box TypeScript / JSX support
- Filtering, timeouts, concurrent for suite and tests
- Sharding support
- Run your tests in the browser natively (experimental)

> Vitest requires Vite >=v5.0.0 and Node >=v18.0.0

```ts
import { assert, describe, expect, it } from 'vitest'

describe('suite name', () => {
  it('foo', () => {
    expect(1 + 1).toEqual(2)
    expect(true).to.be.true
  })

  it('bar', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('snapshot', () => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })
})
```

```bash
$ npx vitest
```

## Sponsors

### Vladimir Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/sheremet-va/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/sheremet-va/static/sponsors.svg'/>
  </a>
</p>

### Anthony Fu Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

### Patak Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/patak-dev/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/patak-dev/static/sponsors.svg'/>
  </a>
</p>

## Credits

Thanks to:

- [The Jest team and community](https://jestjs.io/) for creating a delightful testing API
- [@lukeed](https://github.com/lukeed) for the work on [uvu](https://github.com/lukeed/uvu) where we are inspired a lot from.
- [@pi0](https://github.com/pi0) for the idea and implementation of using Vite to transform and bundle the server code.
- [The Vite team](https://github.com/vitejs/vite) for brainstorming the initial idea.
- [@patak-dev](https://github.com/patak-dev) for the awesome package name!

## Contribution
See [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) License © 2021-Present [Anthony Fu](https://github.com/antfu), [Matias Capeletto](https://github.com/patak-dev)
