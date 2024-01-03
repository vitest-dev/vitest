# Improving Performance

By default Vitest runs every test file in an isolated environment based on the [pool](/config/#pool):

- `threads` pool runs every test file in a separate [`Worker`](https://nodejs.org/api/worker_threads.html#class-worker)
- `forks` pool runs every test file in a separate [forked child process](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)
- `vmThreads` pool runs every test file in a separate [VM context](https://nodejs.org/api/vm.html#vmcreatecontextcontextobject-options), but it uses workers for parallelism

This greatly increases test times, which might not be desirable for projects that don't rely on side effects and properly cleanup their state (which is usually true for projects with `node` environment). In this case disabling isolation will improve the speed of your tests. To do that, you can provide `--no-isolate` flag to the CLI or set [`test.isolate`](/config/#isolate) property in the config to `false`. If you are using several pools at once with `poolMatchGlobs`, you can also disable isolation for a specific pool you are using.

::: code-group
```bash [CLI]
vitest --no-isolate
```
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    // you can also disable isolation only for specific pools
    poolOptions: {
      forks: {
        isolate: false,
      },
    },
  },
})
```
:::

:::tip
If you are using `vmThreads` pool, you cannot disable isolation. Use `threads` pool instead to improve your tests performance.
:::

For some projects, it might also be desirable to disable parallelism to improve startup time. To do that, provide `--no-file-parallelism` flag to the CLI or set [`test.fileParallelism`](/config/#fileParallelism) property in the config to `false`.

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
