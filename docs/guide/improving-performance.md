# Improving Performance

## Profile First

The `Duration` line compares time attributed to user code with time attributed to Vitest:

```
Duration  3.76s (user code 15%, Vitest 85%)
```

`user code` combines test execution, setup files, and importing test files and their dependencies, excluding tracked module fetch/transform waits. It includes hooks, fixtures, async waits, and Vitest APIs called during those phases. `Vitest` combines module fetch/transform waits, environment setup, worker preparation, and type checking.

This is a lightweight attribution of existing elapsed-time measurements, not a CPU profile or an exclusive accounting of every function. For example, assertion work inside a test is included in `user code`, and loading a custom environment is included in `Vitest`. The split does not measure startup before the test run, reporting, or every teardown operation. It adds no instrumentation to test execution. Use [CPU profiling](/guide/profiling-test-performance#test-runner) to identify expensive functions within a phase.

The percentages are relative to the sum of all tracked phases, not to the wall-clock duration: phases run in parallel workers, so their sum is usually larger than the run itself. In a multi-project setup the percentages aggregate over all [projects](/guide/projects), so a phase that dominates one project can be diluted by the others; the performance hints below analyze each project separately.

Use `vitest run --reporter=verbose` to also see the individual phases, with their durations and shares of tracked time:

```
Duration  3.76s (user code 15%, Vitest 85%)
 Timings  environment 3.95s (79%), import 650ms (13%), transform 300ms (6%), tests 50ms (1%), setup 50ms (1%)
```

The phases map to configuration options:

- `environment` - creating the test environment (for example `jsdom`, `happy-dom`) for test files. See [Test Environments](#test-environments).
- `transform` - waiting for Vite to resolve and transform imported modules. See [Caching Between Reruns](#caching-between-reruns).
- `import` - evaluating test files and their modules, excluding the transform wait tracked above. When files import mostly the same modules (typical for barrel-file imports), isolation re-evaluates that shared graph for every file. See [Test Isolation](#test-isolation).
- `setup` - running [`setupFiles`](/config/setupfiles).
- `worker` - preparing the test runner in each worker. Isolation pays this cost for every test file. See [Test Isolation](#test-isolation).
- `tests` - running the tests themselves. A run dominated by this phase has little to gain from configuration changes.

When the collected timings show that a configuration change would make the run significantly faster, Vitest also prints a hint after the summary, see [`experimental.diagnostics`](/config/experimental#experimental-diagnostics). Hints never suggest changing an option that was set explicitly.

[`vitest doctor`](/guide/cli#vitest-doctor) measures the alternative configurations instead of estimating them: it runs the suite under each candidate and reports the comparison, including whether the tests pass with `isolate: false`.

## Test Isolation

By default Vitest runs every test file in an isolated environment based on the [pool](/config/pool):

- `threads` pool runs every test file in a separate [`Worker`](https://nodejs.org/api/worker_threads.html#class-worker)
- `forks` pool runs every test file in a separate [forked child process](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)
- `vmThreads` pool runs every test file in a separate [VM context](https://nodejs.org/api/vm.html#vmcreatecontextcontextobject-options), but it uses workers for parallelism

This greatly increases test times, which might not be desirable for projects that don't rely on side effects and properly cleanup their state (which is usually true for projects with `node` environment). In this case disabling isolation will improve the speed of your tests. To do that, you can provide `--no-isolate` flag to the CLI or set [`test.isolate`](/config/isolate) property in the config to `false`.

::: code-group

```bash [CLI]
vitest --no-isolate
```

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
  },
})
```

:::

You can also disable isolation for specific files only by using `projects`:

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'Isolated',
          isolate: true, // (default value)
          exclude: ['**.non-isolated.test.ts'],
        },
      },
      {
        test: {
          name: 'Non-isolated',
          isolate: false,
          include: ['**.non-isolated.test.ts'],
        },
      },
    ],
  },
})
```

:::tip
If you are using `vmThreads` pool, you cannot disable isolation. Use `threads` pool instead to improve your tests performance.
:::

For some projects, it might also be desirable to disable parallelism to improve startup time. To do that, provide `--no-file-parallelism` flag to the CLI or set [`test.fileParallelism`](/config/fileparallelism) property in the config to `false`.

::: code-group

```bash [CLI]
vitest --no-file-parallelism
```

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
```

:::

## Test Environments

DOM environments are expensive to create: `jsdom` costs roughly 200-500ms per import and `happy-dom` roughly 90-200ms, plus the time to construct the window. With an isolating pool (the default), that cost is paid for every test file, because every file gets a fresh worker. On DOM-heavy suites this is often the largest cost of the run; it appears as the `environment` share of the `Duration` breakdown.

Three configurations reduce this cost:

| configuration                                           | environment created | isolation                                                              | trade-off                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pool: 'forks'`/`'threads'` + `isolate: true` (default) | once per file       | fresh process/thread and environment per file                          | safest, slowest                                                                                                                                                                      |
| `pool: 'vmThreads'`                                     | once per worker     | fresh VM context and `window` per file                                 | test code runs in a VM realm: cross-realm `instanceof` edge cases with externalized packages, and memory is not reclaimed as reliably (see [`vmMemoryLimit`](/config/vmmemorylimit)) |
| `isolate: false`                                        | once per worker     | none - files in the same worker share the environment and module state | tests must not depend on a clean `window` or module state; run `vitest doctor` to check                                                                                              |

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    pool: 'vmThreads', // environment per worker, fresh window per file
  },
})
```

Prefer `isolate: false` with `threads` if the tests tolerate shared state: it is the fastest option and keeps memory behavior simple. Use `vmThreads` when every file needs a fresh `window` and the per-file environment cost dominates the run. `happy-dom` is cheaper to create than `jsdom` in every setup.

## Limiting Directory Search

You can limit the working directory when Vitest searches for files using [`test.dir`](/config/dir) option. This should make the search faster if you have unrelated folders and files in the root directory.

## Caching Between Reruns

In watch mode, Vitest caches all transformed files in memory, which makes reruns fast. However, this cache is discarded once the test run finishes. With [`fsModuleCache`](/config/fsmodulecache) (enabled by default), Vitest persists this cache to the file system so it can be reused across reruns.

This improvement is most noticeable when rerunning a small number of tests that depend on a large module graph. For full test suites, parallelization already mitigates the cost because other tests populate the in-memory cache while earlier tests are still running. For example, running one test file with a huge module graph (>900 modules):

```shell
# the first run
Duration  8.75s (user code 68%, Vitest 32%)

# the second run
Duration  5.90s (user code 87%, Vitest 13%)
```

## Node Compile Cache

Vitest supports Node's [on-disk compile cache](https://nodejs.org/api/cli.html#node_compile_cachedir): when the `NODE_COMPILE_CACHE` environment variable points at a directory, the V8 bytecode of Vitest's own modules and of your externalized dependencies is written to disk and reused by later runs instead of being recompiled. Vitest propagates the variable to every worker, and workers persist the modules they compiled when they shut down.

```shell
NODE_COMPILE_CACHE=node_modules/.cache/node-compile-cache vitest
```

The first run with an empty directory pays for serializing the compiled modules, so this is only worth enabling when the directory survives between runs: local runs, or CI pipelines that cache the directory. `NODE_DISABLE_COMPILE_CACHE=1` disables the cache entirely, taking precedence over `NODE_COMPILE_CACHE`.

Note that Vitest automatically disables the compile cache in workers when the `v8` coverage provider is enabled — V8 serializes cached scripts without the source positions that precise coverage relies on.

## Pool

By default Vitest runs tests in `pool: 'forks'`. While `'forks'` pool is better for compatibility issues ([hanging process](/guide/common-errors#failed-to-terminate-worker) and [segfaults](/guide/common-errors#segfaults-and-native-code-errors)), it may be slightly slower than `pool: 'threads'` in larger projects.

You can try to improve test run time by switching `pool` option in configuration:

::: code-group

```bash [CLI]
vitest --pool=threads
```

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'threads',
  },
})
```

:::

## Sharding

Test sharding is a process of splitting your test suite into groups, or shards. This can be useful when you have a large test suite and multiple machines that could run subsets of that suite simultaneously.

To split Vitest tests on multiple different runs, use [`--shard`](/guide/cli#shard) option with [`--reporter=blob`](/guide/reporters#blob-reporter) option:

```sh
vitest run --reporter=blob --shard=1/3 # 1st machine
vitest run --reporter=blob --shard=2/3 # 2nd machine
vitest run --reporter=blob --shard=3/3 # 3rd machine
```

> Vitest splits your _test files_, not your test cases, into shards. If you've got 1000 test files, the `--shard=1/4` option will run 250 test files, no matter how many test cases individual files have.

Collect the results stored in `.vitest/blob/` directory from each machine and merge them with [`--merge-reports`](/guide/cli#merge-reports) option:

```sh
vitest run --merge-reports
```

When running the same shards across multiple environments, set the `VITEST_BLOB_LABEL` environment variable so merged reports can display them separately:

```sh
VITEST_BLOB_LABEL=linux vitest run --reporter=blob --shard=1/3
```

::: details GitHub Actions example
This setup is also used at https://github.com/vitest-tests/test-sharding.

```yaml
# Inspired from https://playwright.dev/docs/test-sharding
name: Tests
on:
  push:
    branches:
      - main
jobs:
  tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Install pnpm
        uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0

      - name: Install dependencies
        run: pnpm i

      - name: Run tests
        run: pnpm run test --reporter=blob --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          VITEST_BLOB_LABEL: ${{ matrix.os }}

      - name: Upload Vitest results GitHub Actions Artifacts
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: vitest-results-${{ matrix.os }}-${{ matrix.shardIndex }}
          path: .vitest
          include-hidden-files: true
          retention-days: 1

  merge-reports:
    if: ${{ !cancelled() }}
    needs: [tests]

    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Install pnpm
        uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0

      - name: Install dependencies
        run: pnpm i

      - name: Download Vitest results from GitHub Actions Artifacts
        uses: actions/download-artifact@v4
        with:
          path: .vitest
          merge-multiple: true

      - name: Merge reports
        run: npx vitest --merge-reports
```

If your tests create file-based attachments (for example via `context.annotate` or custom artifacts), upload and restore [`attachmentsDir`](/config/attachmentsdir) in the merge job as shown above.

:::

:::tip
Test sharding can also become useful on high CPU-count machines.

Vitest will run only a single Vite server in its main thread. Rest of the threads are used to run test files.
In a high CPU-count machine the main thread can become a bottleneck as it cannot handle all the requests coming from the threads. For example in 32 CPU machine the main thread is responsible to handle load coming from 31 test threads.

To reduce the load from main thread's Vite server you can use test sharding. The load can be balanced on multiple Vite server.

```sh
# Example for splitting tests on 32 CPU to 4 shards.
# As each process needs 1 main thread, there's 7 threads for test runners (1+7)*4 = 32
# Use VITEST_MAX_WORKERS:
VITEST_MAX_WORKERS=7 vitest run --reporter=blob --shard=1/4 & \
VITEST_MAX_WORKERS=7 vitest run --reporter=blob --shard=2/4 & \
VITEST_MAX_WORKERS=7 vitest run --reporter=blob --shard=3/4 & \
VITEST_MAX_WORKERS=7 vitest run --reporter=blob --shard=4/4 & \
wait # https://man7.org/linux/man-pages/man2/waitpid.2.html

vitest run --merge-reports
```

:::
