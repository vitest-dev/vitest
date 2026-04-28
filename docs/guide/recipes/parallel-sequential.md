---
title: Parallel and Sequential Test Files | Recipes
---

# Parallel and Sequential Test Files

Most test files are independent and run faster in parallel. The exception is the handful that share an exclusive resource, like a fixed port, a writable temp directory, or a database without per-test isolation. Those files flake when other tests run concurrently with them.

Disabling parallelism globally would slow down every test in the suite. Splitting the suite into two [`projects`](/guide/projects), one parallel and one sequential, lets only the affected files pay the cost.

## Pattern

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'Parallel',
          exclude: ['**.sequential.test.ts'],
        },
      },
      {
        test: {
          name: 'Sequential',
          include: ['**.sequential.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
})
```

[`fileParallelism: false`](/config/fileparallelism) at the project level keeps the rest of your suite running concurrently while the matched files run one at a time. It's a shorthand for [`maxWorkers: 1`](/config/maxworkers); the two settings are equivalent.

## Run sequential after parallel

By default, projects run in parallel with each other, so the sequential project's first file may overlap with parallel files that still hold the same resource. Use [`sequence.groupOrder`](/config/sequence#sequence-grouporder) <Version>3.2.0</Version> to force the parallel batch to finish first:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'Parallel',
          exclude: ['**.sequential.test.ts'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: 'Sequential',
          include: ['**.sequential.test.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
```

The parallel batch finishes, *then* the sequential batch starts. Total wall clock stays close to the parallel time plus the longest sequential chain.

## File scope vs. test scope

There are two different "parallel" knobs in Vitest. Don't confuse them:

| Scope | Knob | Controls |
| --- | --- | --- |
| Across files | [`fileParallelism`](/config/fileparallelism) | Whether two test *files* run in parallel workers |
| Within a file | `describe.concurrent` / `test.concurrent` | Whether tests *inside one file* run concurrently |

`fileParallelism: false` doesn't make tests inside a file concurrent; tests inside a file are sequential by default. And `concurrent` on a `describe` or `test` doesn't affect how files are scheduled.

## See also

- [`fileParallelism`](/config/fileparallelism)
- [`maxWorkers`](/config/maxworkers)
- [`sequence.groupOrder`](/config/sequence#sequence-grouporder)
- [Parallelism](/guide/parallelism)
- [Test Projects](/guide/projects)
- [Per-File Isolation Settings](/guide/recipes/disable-isolation)
