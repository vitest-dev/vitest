# Custom Benchmark Provider <Version type="experimental">5.0.0</Version> <Badge type="danger">advanced</Badge> {#custom-benchmark-provider}

::: warning
This is an advanced, experimental API. If you only need to run benchmarks with Vitest's built-in provider, read the [Benchmarking](/guide/benchmarking) guide instead.
:::

Vitest uses a benchmark provider to execute the functions registered with `bench` and convert their measurements into results that Vitest can report. The built-in provider uses [Tinybench](https://github.com/tinylibs/tinybench), but you can replace it to use another benchmarking engine or execution strategy.

## Setup

Set [`benchmark.provider`](/config/benchmark#benchmark-provider) to the path of your provider module. Relative paths are resolved from the project root.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      provider: './benchmark-provider.ts',
    },
  },
})
```

The module must has a default export with an object that implements `BenchmarkProvider`. This example wraps Tinybench to demonstrate how registrations and results flow through a provider. If you use Tinybench in your provider, add it as a direct dependency of your project.

```ts [benchmark-provider.ts]
import type { BenchmarkProvider } from 'vitest'
import { Bench } from 'tinybench'

const provider = {
  async run({ test, config, registrations, options }) {
    const bench = new Bench({
      signal: test.context.signal,
      retainSamples: config.retainSamples,
      ...options,
    })

    for (const { name, fn, fnOpts } of registrations) {
      bench.add(name, fn, fnOpts)
    }

    await bench.run()

    return bench.tasks.map((task) => {
      const result = task.result

      if (result.state === 'errored') {
        throw result.error
      }
      if (result.state !== 'completed') {
        throw new Error(`Benchmark "${task.name}" ended in the "${result.state}" state`)
      }

      return {
        ...result,
        name: task.name,
      }
    })
  },
} satisfies BenchmarkProvider

export default provider
```

## Provider API

Vitest calls `provider.run(group)` when a registration's `.run()` method is called, or once for all runnable registrations passed to `bench.compare()`. The `group` contains:

- `test`: the test that registered the benchmarks. `test.context.signal` is aborted when the run is cancelled.
- `config`: the resolved benchmark configuration for the current project.
- `registrations`: runnable benchmarks in registration order. Every registration contains `name`, `fn`, and optional `fnOpts` for lifecycle hooks, cancellation, async behavior, and sample retention.
- `options`: benchmark run options passed to `.run()` or `bench.compare()`, if any.

The provider is responsible for honoring the run and registration options and for running every benchmark function and its `beforeAll`, `beforeEach`, `afterEach`, and `afterAll` hooks according to the benchmarking engine's lifecycle. If execution fails, throw the error to fail the test.

`run` must resolve to one `BenchResult` for every runnable registration. Results are matched to registrations by `name` and are the source for `.run()` return values, comparison tables, reporters, and saved benchmark results. A custom engine must convert its measurements into the Tinybench-compatible `BenchResult` shape exported by `vitest`.

Registrations created by `bench.from()` are loaded by Vitest and are not passed to the provider.

## Provider Lifetime

Vitest imports the provider module on first use and caches its default export for the lifetime of the worker. The API does not have separate setup or teardown hooks; keep worker-scoped state on the provider object when needed.
