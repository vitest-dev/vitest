---
outline: deep
---

# Features

<FeaturesList class="!gap-1 text-lg" />

## Shared config between test, dev and build

Vite's config, transformers, resolvers, and plugins. Use the same setup from your app to run the tests.

Learn more at [Configuring Vitest](/guide/#configuring-vitest)

## Watch Mode

```bash
$ vitest
```

When you modify your source code or the test files, Vitest smartly searches the module graph and only rerun the related tests, [just like how HMR works in Vite!](https://twitter.com/antfu7/status/1468233216939245579)

`vitest` starts in `watch mode` **by default in development environment** and `run mode` in CI environment (when `process.env.CI` presents) smartly. You can use `vitest watch` or `vitest run` to explicitly specify the desired mode.

## Common web idioms out-of-the-box

Out-of-box ES Module / TypeScript / JSX support / PostCSS

## Threads

Workers multi-threading via [tinypool](https://github.com/Aslemammad/tinypool) (a lightweight fork of [Piscina](https://github.com/piscinajs/piscina)), allowing tests to run simultaneously. Threads are enabled by default in Vitest, and can be disabled passing `--no-threads` in the CLI.

Vitest also isolates each file's environment so env mutations in one file don't affect others. Isolation can be disabled by passing `--no-isolate` to the CLI (trading of correctness for run performance).

## Test Filtering

Vitest provided many ways to narrow down the tests to run to speed up and focus during the development.

Learn more about [Test Filtering](./filtering.md)

## Running tests concurrently

Use `.concurrent` in consecutive tests to run them in parallel

```ts
import { describe, it } from 'vitest'

// The two tests marked with concurrent will be run in parallel
describe('suite', () => {
  it('serial test', async () => { /* ... */ })
  it.concurrent('concurrent test 1', async () => { /* ... */ })
  it.concurrent('concurrent test 2', async () => { /* ... */ })
})
```

If you use `.concurrent` in a suite, every tests in it will be run in parallel

```ts
import { describe, it } from 'vitest'

// All tests within this suite will be run in parallel
describe.concurrent('suite', () => {
  it('concurrent test 1', async () => { /* ... */ })
  it('concurrent test 2', async () => { /* ... */ })
  it.concurrent('concurrent test 3', async () => { /* ... */ })
})
```

You can also use `.skip`, `.only`, and `.todo` with concurrent suites and tests. Read more in the [API Reference](../api/#concurrent)

## Snapshot

[Jest-compatible](https://jestjs.io/docs/snapshot-testing) snapshot support.

```ts
import { expect, it } from 'vitest'

it('renders correctly', () => {
  const result = render()
  expect(result).toMatchSnapshot()
})
```

Learn more at [Snapshot](/guide/snapshot)

## Chai and Jest expect compatibility

[Chai](https://www.chaijs.com/) built-in for assertions plus [Jest expect](https://jestjs.io/docs/expect) compatible APIs

Notice that if you are using third-party libraries that add matchers, setting `test.globals` to `true` will provide better compatibility

## Mocking

[Tinyspy](https://github.com/Aslemammad/tinyspy) built-in for mocking with `jest` compatible APIs on `vi` object.

```ts
import { expect, vi } from 'vitest'

const fn = vi.fn()

fn('hello', 1)

expect(vi.isMockFunction(fn)).toBe(true)
expect(fn.mock.calls[0]).toEqual(['hello', 1])

fn.mockImplementation(arg => arg)

fn('world', 2)

expect(fn.mock.results[1].value).toBe('world')
```

Vitest supports both [happy-dom](https://github.com/capricorn86/happy-dom) or [jsdom](https://github.com/jsdom/jsdom) for mocking DOM and browser APIs. They don't come with Vitest, you might need to install them:

```bash
$ npm i -D happy-dom
# or
$ npm i -D jsdom
```

After that, change the `environment` option in your config file:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom', 'node'
  },
})
```

Learn more at [Mocking](/guide/mocking)

## Coverage

Vitest supports Native code coverage via [c8](https://github.com/bcoe/c8)

```json
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

To configure it, set `test.coverage` options in your config file:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

## In-source testing

Vitest also provides a way to run tests with in your source code along with the implementation, similar to [Rust's module tests](https://doc.rust-lang.org/book/ch11-03-test-organization.html#the-tests-module-and-cfgtest).

This makes the tests share the same closure as the implementations and able to test against private states without exporting. Meanwhile, it also brings the closer feedback loop for development.

```ts
// src/index.ts

// the implementation
export function add(...args: number[]) {
  return args.reduce((a, b) => a + b, 0)
}

// in-source test suites
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('add', () => {
    expect(add()).toBe(0)
    expect(add(1)).toBe(1)
    expect(add(1, 2, 3)).toBe(6)
  })
}
```

Learn more at [In-source testing](/guide/in-source)
