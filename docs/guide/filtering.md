---
title: Test Filtering | Guide
---

# Test Filtering

Filtering, timeouts, concurrent for suite and tests

## CLI

You can use CLI to filter test files by name:

```bash
$ vitest basic
```

Will only execute test files that contain `basic`, e.g.

```
basic.test.ts
basic-foo.test.ts
basic/foo.test.ts
```

You can also use the `-t, --testNamePattern <pattern>	` option to filter tests by full name. This can be helpful when you want to filter by the name defined within a file rather than the filename itself.

## Specifying a Timeout

You can optionally pass a timeout in milliseconds as third argument to tests. The default is 5 seconds.

```ts
import { test } from 'vitest'

test('name', async () => { /* ... */ }, 1000)
```

Hooks also can receive a timeout, with the same 5 seconds default.

```ts
import { beforeAll } from 'vitest'

beforeAll(async () => { /* ... */ }, 1000)
```

## Skipping Suites and Tests

Use `.skip` to avoid running certain suites or tests

```ts
import { assert, describe, it } from 'vitest'

describe.skip('skipped suite', () => {
  it('test', () => {
    // Suite skipped, no error
    assert.equal(Math.sqrt(4), 3)
  })
})

describe('suite', () => {
  it.skip('skipped test', () => {
    // Test skipped, no error
    assert.equal(Math.sqrt(4), 3)
  })
})
```

## Selecting Suites and Tests to Run

Use `.only` to only run certain suites or tests

```ts
import { assert, describe, it } from 'vitest'

// Only this suite (and others marked with only) are run
describe.only('suite', () => {
  it('test', () => {
    assert.equal(Math.sqrt(4), 3)
  })
})

describe('another suite', () => {
  it('skipped test', () => {
    // Test skipped, as tests are running in Only mode
    assert.equal(Math.sqrt(4), 3)
  })

  it.only('test', () => {
    // Only this test (and others marked with only) are run
    assert.equal(Math.sqrt(4), 2)
  })
})
```

## Unimplemented Suites and Tests

Use `.todo` to stub suites and tests that should be implemented

```ts
import { describe, it } from 'vitest'

// An entry will be shown in the report for this suite
describe.todo('unimplemented suite')

// An entry will be shown in the report for this test
describe('suite', () => {
  it.todo('unimplemented test')
})
```
