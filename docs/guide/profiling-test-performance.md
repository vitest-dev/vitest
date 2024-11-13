# Profiling Test Performance

When you run Vitest it reports multiple time metrics of your tests:

> ```bash
> RUN  v2.1.1 /x/vitest/examples/profiling
>
> ✓ test/prime-number.test.ts (1) 4517ms
>   ✓ generate prime number 4517ms
>
> Test Files  1 passed (1)
>      Tests  1 passed (1)
>   Start at  09:32:53
>   Duration  4.80s (transform 44ms, setup 0ms, collect 35ms, tests 4.52s, environment 0ms, prepare 81ms)
>   # Time metrics ^^
> ```

- Transform: How much time was spent transforming the files. See [File Transform](#file-transform).
- Setup: Time spent for running the [`setupFiles`](/config/#setupfiles) files.
- Collect: Time spent for collecting all tests in the test files. This includes the time it took to import all file dependencies.
- Tests: Time spent for actually running the test cases.
- Environment: Time spent for setting up the test [`environment`](/config/#environment), for example JSDOM.
- Prepare: Time Vitest uses to prepare the test runner.

## Test runner

In cases where your test execution time is high, you can generate a profile of the test runner. See NodeJS documentation for following options:

- [`--cpu-prof`](https://nodejs.org/api/cli.html#--cpu-prof)
- [`--heap-prof`](https://nodejs.org/api/cli.html#--heap-prof)
- [`--prof`](https://nodejs.org/api/cli.html#--prof)

:::warning
The `--prof` option does not work with `pool: 'threads'` due to `node:worker_threads` limitations.
:::

To pass these options to Vitest's test runner, define `poolOptions.<pool>.execArgv` in your Vitest configuration:

::: code-group
```ts [Forks]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: [
          '--cpu-prof',
          '--cpu-prof-dir=test-runner-profile',
          '--heap-prof',
          '--heap-prof-dir=test-runner-profile'
        ],

        // To generate a single profile
        singleFork: true,
      },
    },
  },
})
```
```ts [Threads]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        execArgv: [
          '--cpu-prof',
          '--cpu-prof-dir=test-runner-profile',
          '--heap-prof',
          '--heap-prof-dir=test-runner-profile'
        ],

        // To generate a single profile
        singleThread: true,
      },
    },
  },
})
```
:::

After the tests have run there should be a `test-runner-profile/*.cpuprofile` and `test-runner-profile/*.heapprofile` files generated. See [Inspecting profiling records](#inspecting-profiling-records) for instructions how to analyze these files.

See [Profiling | Examples](https://github.com/vitest-dev/vitest/tree/main/examples/profiling) for example.

## Main thread

Profiling main thread is useful for debugging Vitest's Vite usage and [`globalSetup`](/config/#globalsetup) files.
This is also where your Vite plugins are running.

:::tip
See [Performance | Vite](https://vitejs.dev/guide/performance.html) for more tips about Vite specific profiling.

We recommend [`vite-plugin-inspect`](https://github.com/antfu-collective/vite-plugin-inspect) for profiling your Vite plugin performance.
:::

To do this you'll need to pass arguments to the Node process that runs Vitest.

```bash
$ node --cpu-prof --cpu-prof-dir=main-profile ./node_modules/vitest/vitest.mjs --run
#      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                                  ^^^^^
#               NodeJS arguments                                           Vitest arguments
```

After the tests have run there should be a `main-profile/*.cpuprofile` file generated. See [Inspecting profiling records](#inspecting-profiling-records) for instructions how to analyze these files.

## File transform

In cases where your test transform and collection time is high, you can use `DEBUG=vite-node:*` environment variable to see which files are being transformed and executed by `vite-node`.

```bash
$ DEBUG=vite-node:* vitest --run

 RUN  v2.1.1 /x/vitest/examples/profiling

  vite-node:server:request /x/vitest/examples/profiling/global-setup.ts +0ms
  vite-node:client:execute /x/vitest/examples/profiling/global-setup.ts +0ms
  vite-node:server:request /x/vitest/examples/profiling/test/prime-number.test.ts +45ms
  vite-node:client:execute /x/vitest/examples/profiling/test/prime-number.test.ts +26ms
  vite-node:server:request /src/prime-number.ts +9ms
  vite-node:client:execute /x/vitest/examples/profiling/src/prime-number.ts +9ms
  vite-node:server:request /src/unnecessary-file.ts +6ms
  vite-node:client:execute /x/vitest/examples/profiling/src/unnecessary-file.ts +4ms
...
```

This profiling strategy is a good way to identify unnecessary transforms caused by [barrel files](https://vitejs.dev/guide/performance.html#avoid-barrel-files).
If these logs contain files that should not be loaded when your test is run, you might have barrel files that are importing files unnecessarily.

You can also use [Vitest UI](/guide/ui) to debug slowness caused by barrel file.
The example below shows how importing files without barrel file reduces amount of transformed files by ~85%.

::: code-group
``` [File tree]
├── src
│   └── utils
│       ├── currency.ts
│       ├── formatters.ts  <-- File to test
│       ├── index.ts
│       ├── location.ts
│       ├── math.ts
│       ├── time.ts
│       └── users.ts
├── test
│   └── formatters.test.ts
└── vitest.config.ts
```
```ts [example.test.ts]
import { expect, test } from 'vitest'
import { formatter } from '../src/utils' // [!code --]
import { formatter } from '../src/utils/formatters' // [!code ++]

test('formatter works', () => {
  expect(formatter).not.toThrow()
})
```
:::

<img src="/module-graph-barrel-file.png" alt="Vitest UI demonstrating barrel file issues" />

To see how files are transformed, you can use `VITE_NODE_DEBUG_DUMP` environment variable to write transformed files in the file system:

```bash
$ VITE_NODE_DEBUG_DUMP=true vitest --run

[vite-node] [debug] dump modules to /x/examples/profiling/.vite-node/dump

 RUN  v2.1.1 /x/vitest/examples/profiling
...

$ ls .vite-node/dump/
_x_examples_profiling_global-setup_ts-1292904907.js
_x_examples_profiling_test_prime-number_test_ts-1413378098.js
_src_prime-number_ts-525172412.js
```

## Inspecting profiling records

You can inspect the contents of `*.cpuprofile` and `*.heapprofile` with various tools. See list below for examples.

- [Speedscope](https://www.speedscope.app/)
- [Performance Profiling JavaScript in Visual Studio Code](https://code.visualstudio.com/docs/nodejs/profiling#_analyzing-a-profile)
- [Profile Node.js performance with the Performance panel | developer.chrome.com](https://developer.chrome.com/docs/devtools/performance/nodejs#analyze)
- [Memory panel overview | developer.chrome.com](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots#view_snapshots)
