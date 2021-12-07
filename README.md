<p align="center">
<img src="https://user-images.githubusercontent.com/11247099/145111547-db79cf70-dcfd-45ce-8f18-5684edc56828.png" height="200">
</p>

<h1 align="center">
Vitest
</h1>
<p align="center">
A blazing fast unit test framework powered by Vite.
<p>
<p align="center">
  <a herf="https://www.npmjs.com/package/vitest"><img src="https://img.shields.io/npm/v/vitest?color=a1b858&label="></a>
<p>

> 💖 **This project is currently in closed beta exclusively for Sponsors.**<br>
> Become a Sponsor of [@patak-js](https://github.com/sponsors/patak-js) or [@antfu](https://github.com/sponsors/antfu) to access the source code and issues tracker.

> ⚠️ **DISCLAIMER**: Vitest is still in development and not stable yet. It's not recommended to use it in production.

> Vitest requires Vite v2.7.0 or above

[**Join the Discord!**](https://discord.com/invite/2zYZNngd7y)

## Features

- [Vite](https://vitejs.dev/)'s config, transformers, resolvers, and plugins. Use the same setup from your app!
- [Jest Snapshot](https://jestjs.io/docs/snapshot-testing)
- [Chai](https://www.chaijs.com/) built-in for assertions, with [jest-expect](https://jestjs.io/docs/expect) compatible APIs.
- [Smart watch mode](#watch-mode), just like HMR for tests!
- [Code coverage](#coverage)
- [Sinon](https://sinonjs.org/) built-in for mocking
- [JSDOM](https://github.com/jsdom/jsdom) built-in for DOM and browser API mocking
- Components testing ([Vue example](./test/vue), [React example](./test/react))
- Async suite / test, top level await
- ESM friendly
- Out-of-box TypeScript / JSX support
- Suite and Test filtering (skip, only, todo)

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

## Configuration

`vitest` will read your root `vite.config.ts` when it present to match with the plugins and setup as your Vite app. If you want to it to have a different configuration for testing, you could either:

- Create `vitest.config.ts`, which will have the higher priority
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` to conditionally apply differnet configuration in `vite.config.ts`

To configure `vitest` itself, add `test` property in your Vite config

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ...
  }
})
```

## Global APIs

By default, `vitest` does not provide global APIs for explicitness. If you prefer to use the APIs globally like Jest, you can pass the `--global` option to CLI or add `global: true` in the config.

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    global: true
  }
})
```

To get TypeScript working with the global APIs, add `vitest/global` to the `types` filed in your `tsconfig.json`

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": [
      "vitest/global"
    ]
  }
}
```

## Browser Mocking

Pass `--jsdom` option in CLI to enable browser mocking. Or the `jsdom` flag in the config.

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    jsdom: true
  }
})
```

## Watch Mode

```bash
$ vitest -w
```

Vitest smartly searches the module graph and only rerun the related tests (just like how HMR works in Vite!).

## Coverage

Vitest works perfectly with [c8](https://github.com/bcoe/c8)

```bash
$ c8 vitest
```

```json
{
  "scripts": {
    "test": "vitest",
    "coverage": "c8 vitest"
  }
}
```

For convenience, we also provide a shorthand for passing `--coverage` option to CLI, which will wrap the process with `c8` for you. Note when using the shorthand, you will lose the ability to pass additional options to `c8`.

```bash
$ vitest --coverage
```

For more configuration avaliable, please refer to [c8](https://github.com/bcoe/c8)'s documentation.

## Filtering

### CLI

You can use CLI to filter test files my name:

```bash
$ vitest basic
```

Will only execute test files that contain `basic`, e.g.

```
basic.test.ts
basic-foo.test.ts
```

### Skipping suites and tasks

Use `.skip` to avoid running certain suites or tests 

```ts
describe.skip('skipped suite', () => {
  it('task', () => {
    // Suite skipped, no error
    assert.equal(Math.sqrt(4), 3)
  })
})

describe('suite', () => {
  it.skip('skipped task', () => {
    // Task skipped, no error
    assert.equal(Math.sqrt(4), 3)
  })
})
```

### Selecting suites and tests to run

Use `.only` to only run certain suites or tests 

```ts
// Only this suite (and others marked with only) are run
describe.only('suite', () => {
  it('task', () => {
    assert.equal(Math.sqrt(4), 3) 
  })
})

describe('another suite', () => {
  it('skipped task', () => {
     // Task skipped, as tests are running in Only mode
    assert.equal(Math.sqrt(4), 3)
  })

  it.only('task', () => {
     // Only this task (and others marked with only) are run
    assert.equal(Math.sqrt(4), 2)
  })
})
```

### Unimplemented suites and tests

Use `.todo` to stub suites and tests that should be implemented

```ts
 // An entry will be shown in the report for this suite
describe.todo('unimplemented suite')

// An entry will be shown in the report for this task
describe('suite', () => {
  it.todo('unimplemented task')
})
```

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## Credits

Thanks to:

- [@patak-js](https://github.com/patak-js) for the awesome package name!
- [The Vite team](https://github.com/vitejs/vite) for brainstorming the initial idea.
- [@pi0](https://github.com/pi0) for the idea and implementation of using Vite to transform and bundle the server code.
- [@lukeed](https://github.com/lukeed) for the work on [uvu](https://github.com/lukeed/uvu) where we are inspired a lot from.

## License

[MIT](./LICENSE) License © 2021 [Anthony Fu](https://github.com/antfu)
