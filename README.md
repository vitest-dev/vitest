<p align="center">
<img src="https://user-images.githubusercontent.com/11247099/145112184-a9ff6727-661c-439d-9ada-963124a281f7.png" height="200">
</p>

<h1 align="center">
Vitest
</h1>
<p align="center">
A blazing fast unit test framework powered by Vite.
<p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitest"><img src="https://img.shields.io/npm/v/vitest?color=a1b858&label="></a>
<p>
<h3 align="center">
<a href="https://chat.vitest.dev"><i>Get involved!</i></a>
</h3>
<br>
<br>

> ⚠️ **DISCLAIMER**: Vitest is still in development and not stable yet. It's not recommended to use it in production.

> Vitest requires Vite v2.7 and Node v14

Follow the [Getting Started Guide](https://vitest.dev/guide) or learn [why we are building a new test runner](https://vitest.dev/guide/why).

## Documentation

Read the [documentation](https://vitest.dev/).

## Features

- [Vite](https://vitejs.dev/)'s config, transformers, resolvers, and plugins. Use the same setup from your app!
- [Jest Snapshot](https://jestjs.io/docs/snapshot-testing)
- [Chai](https://www.chaijs.com/) built-in for assertions, with [Jest expect](https://jestjs.io/docs/expect) compatible APIs.
- [Smart & instant watch mode](#watch-mode), like HMR for tests!
- [Native code coverage](#coverage) via [c8](https://github.com/bcoe/c8)
- [Tinyspy](https://github.com/Aslemammad/tinyspy) built-in for mocking, stubbing, and spies.
- [JSDOM](https://github.com/jsdom/jsdom) and [happy-dom](https://github.com/capricorn86/happy-dom) for DOM and browser API mocking
- Components testing ([Vue](./test/vue), [React](./test/react), [Lit](./test/lit), [Vitesse](./test/vitesse))
- Workers multi-threading via [tinypool](https://github.com/Aslemammad/tinypool) (a lightweight fork of [Piscina](https://github.com/piscinajs/piscina))
- ESM first, top level await
- Out-of-box TypeScript / JSX support
- Filtering, timeouts, concurrent for suite and tests

```ts
import { it, describe, expect, assert } from 'vitest'

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

## Examples

- [Unit Testing](./test/core)
- [Vue Component Testing](./test/vue)
- [React Component Testing](./test/react)
- [React Mock Service Worker with Testing Library Testing](./test/react-testing-lib-msw)
- [Lit Component Testing](./test/lit)
- [Vitesse Component Testing](./test/vitesse)

## Projects using Vitest

- [unocss](https://github.com/antfu/unocss)
- [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import)
- [unplugin-vue-components](https://github.com/antfu/unplugin-vue-components)
- [vitesse-lite](https://github.com/antfu/vitesse-lite)

## Sponsors

### Anthony Fu Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

### Patak Sponsors

<p align="center">
  <a href="https://patak.dev/sponsors.svg">
    <img src='https://patak.dev/sponsors.svg'/>
  </a>
</p>

## Credits

Thanks to:

- [The Jest team and community](https://jestjs.io/) for creating a delightful testing API
- [@lukeed](https://github.com/lukeed) for the work on [uvu](https://github.com/lukeed/uvu) where we are inspired a lot from.
- [@pi0](https://github.com/pi0) for the idea and implementation of using Vite to transform and bundle the server code.
- [The Vite team](https://github.com/vitejs/vite) for brainstorming the initial idea.
- [@patak-dev](https://github.com/patak-dev) for the awesome package name!

## License

[MIT](./LICENSE) License © 2021-Present [Anthony Fu](https://github.com/antfu), [Matias Capeletto](https://github.com/patak-dev)
