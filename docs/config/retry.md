---
title: retry | Config
outline: deep
---

# retry

Retry the test specific number of times if it fails.

- **Type:** `number | { count?: number, delay?: number, condition?: RegExp }`
- **Default:** `0`
- **CLI:** `--retry <times>`, `--retry.count <times>`, `--retry.delay <ms>`, `--retry.condition <pattern>`

## Basic Usage

Specify a number to retry failed tests:

```ts
export default defineConfig({
  test: {
    retry: 3,
  },
})
```

## CLI Usage

You can also configure retry options from the command line:

```bash
# Simple retry count
vitest --retry 3

# Advanced options using dot notation
vitest --retry.count 3 --retry.delay 500 --retry.condition 'ECONNREFUSED|timeout'
```

## Advanced Options <Version>4.1.0</Version> {#advanced-options}

Use an object to configure retry behavior:

```ts
export default defineConfig({
  test: {
    retry: {
      count: 3, // Number of times to retry
      delay: 1000, // Delay in milliseconds between retries
      condition: /ECONNREFUSED|timeout/i, // RegExp to match errors that should trigger retry
    },
  },
})
```

### count

Number of times to retry a test if it fails. Default is `0`.

```ts
export default defineConfig({
  test: {
    retry: {
      count: 2,
    },
  },
})
```

### delay

Delay in milliseconds between retry attempts. Useful for tests that interact with rate-limited APIs or need time to recover. Default is `0`.

```ts
export default defineConfig({
  test: {
    retry: {
      count: 3,
      delay: 500, // Wait 500ms between retries
    },
  },
})
```

### condition

A RegExp pattern or a function to determine if a test should be retried based on the error.

- When a **RegExp**, it's tested against the error message
- When a **function**, it receives the error and returns a boolean

::: warning
When defining `condition` as a function, it must be done in a test file directly, not in a configuration file (configurations are serialized for worker threads).
:::

#### RegExp condition (in config file):

```ts
export default defineConfig({
  test: {
    retry: {
      count: 2,
      condition: /ECONNREFUSED|ETIMEDOUT/i, // Retry on connection/timeout errors
    },
  },
})
```

#### Function condition (in test file):

```ts
import { describe, test } from 'vitest'

describe('tests with advanced retry condition', () => {
  test('with function condition', { retry: { count: 2, condition: error => error.message.includes('Network') } }, () => {
    // test code
  })
})
```

## Test File Override

You can also define retry options per test or suite in test files:

```ts
import { describe, test } from 'vitest'

describe('flaky tests', {
  retry: {
    count: 2,
    delay: 100,
  },
}, () => {
  test('network request', () => {
    // test code
  })
})

test('another test', {
  retry: {
    count: 3,
    condition: error => error.message.includes('timeout'),
  },
}, () => {
  // test code
})
```
