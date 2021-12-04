# vitest

[![NPM version](https://img.shields.io/npm/v/vitest?color=a1b858&label=)](https://www.npmjs.com/package/vitest)

A blazing fast test runner powered by Vite.

## Features

- [Vite](https://vitejs.dev/)'s config, transformers, resolvers, and plugins. Powered by [vite-node](https://github.com/antfu/vite-node)
- [Jest Snapshot](https://jestjs.io/docs/snapshot-testing)
- [Chai](https://www.chaijs.com/) for assertions
- [Sinon](https://sinonjs.org/) for mocking
- Async suite / test, top level await
- ESM friendly
- Out-of-box TypeScript support
- Suite and Test filtering (skip, only, todo)

```ts
import { it, describe, expect, assert } from 'vitest'

describe('suite name', () => {
  it('foo', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('bar', () => {
    expect(1 + 1).eq(2)
  })

  it('snapshot', () => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })
})
```

```bash
$ npx vitest
```

## Filtering

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

## TODO

- [x] Reporter & Better output
- [x] Task filter
- [x] Mock
- [ ] Parallel Executing
- [ ] CLI Help
- [ ] JSDom
- [ ] Watch
- [ ] Coverage

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2021 [Anthony Fu](https://github.com/antfu)
