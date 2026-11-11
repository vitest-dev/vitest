---
title: repeats | Config
outline: deep
---

# repeats

- **Type:** `number`
- **Default:** `0`
- **CLI:** `--repeats=<number>`

Repeat every test a specific number of times regardless of the result. A test that uses the [`repeats`](/api/test#repeats) test option takes precedence over this value.

This is useful for verifying that tests are stable across multiple runs. If a test fails on any repetition, the whole test is reported as failed. If a repeat calls `skip()`, Vitest skips only this repeat. The test is skipped only if all of its repeats are skipped.

Each repeat gets its own seed for [`context.random`](/api/random) and [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). See [Seeded Tests](/guide/seeded-tests).

Because the test option takes precedence, `--repeats` does not change a test with its own `repeats`. To run more repeats of some tests in one CI job, set `repeats` on a [tag](/guide/test-tags) in the config instead of on the tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      { name: 'simulation', repeats: process.env.NIGHTLY ? 1999 : 99 },
    ],
  },
})
```
