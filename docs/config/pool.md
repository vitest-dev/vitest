---
title: pool | Config
outline: deep
---

# pool

- **Type:** `'threads' | 'forks' | 'vmThreads' | 'vmForks'`
- **Default:** `'forks'`
- **CLI:** `--pool=threads`

Pool used to run tests in.

## threads

Enable multi-threading. When using threads you are unable to use process related APIs such as `process.chdir()`. Some libraries written in native languages, such as `Prisma`, `bcrypt` and `canvas`, have problems when running in multiple threads and run into segfaults. In these cases it is advised to use `forks` pool instead.

## forks

Similar as `threads` pool but uses `child_process` instead of `worker_threads`. Communication between tests and main process is not as fast as with `threads` pool. Process related APIs such as `process.chdir()` are available in `forks` pool.

## vmThreads

Run tests using [VM context](https://nodejs.org/api/vm.html) (inside a sandboxed environment) in a `threads` pool.

This makes tests run faster, but the VM module is unstable when running [ESM code](https://github.com/nodejs/node/issues/37648). Your tests will [leak memory](https://github.com/nodejs/node/issues/33439) - to battle that, workers are restarted when they exceed [`vmMemoryLimit`](/config/vmmemorylimit).

::: warning Worker recycling is expensive in `vmThreads`
Restarting a worker thread is not free: Node.js runs a full garbage collection over everything the worker accumulated before the thread can exit, and that work runs on a small pool of background threads shared by every worker in the process. When a large test suite hits [`vmMemoryLimit`](/config/vmmemorylimit) repeatedly, these teardowns pile up and also slow down the workers that are still running tests.

The `vmForks` pool recycles workers by letting the child process exit, and the operating system reclaims the memory. If your test suite is large enough to recycle workers, `vmForks` is usually noticeably faster than `vmThreads`, even though its communication with the main process is slower.
:::

::: warning
Running code in a sandbox has some advantages (faster tests), but also comes with a number of disadvantages.

- The globals within native modules, such as (`fs`, `path`, etc), differ from the globals present in your test environment. As a result, any error thrown by these native modules will reference a different Error constructor compared to the one used in your code:

```ts
try {
  fs.writeFileSync('/does-not-exist')
}
catch (err) {
  console.log(err instanceof Error) // false
}
```

- Importing ES modules caches them indefinitely which introduces memory leaks if you have a lot of contexts (test files). There is no API in Node.js that clears that cache.
- Accessing globals [takes longer](https://github.com/nodejs/node/issues/31658) in a sandbox environment.

Please, be aware of these issues when using this option. Vitest team cannot fix any of the issues on our side.
:::

## vmForks

Similar as `vmThreads` pool but uses `child_process` instead of `worker_threads`. Communication between tests and the main process is not as fast as with `vmThreads` pool. Process related APIs such as `process.chdir()` are available in `vmForks` pool. Please be aware that this pool has the same pitfalls listed in `vmThreads`.

Unlike `vmThreads`, recycling a worker that exceeded [`vmMemoryLimit`](/config/vmmemorylimit) only requires the child process to exit, so it is much cheaper. On large test suites that recycle workers regularly, prefer `vmForks` over `vmThreads`.
