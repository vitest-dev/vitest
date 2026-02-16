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

Enable multi-threading. When using threads you are unable to use process related APIs such as `process.chdir()`. Some libraries written in native languages, such as Prisma, `bcrypt` and `canvas`, have problems when running in multiple threads and run into segfaults. In these cases it is advised to use `forks` pool instead.

## forks

Similar as `threads` pool but uses `child_process` instead of `worker_threads`. Communication between tests and main process is not as fast as with `threads` pool. Process related APIs such as `process.chdir()` are available in `forks` pool.

## vmThreads

Run tests using [VM context](https://nodejs.org/api/vm.html) (inside a sandboxed environment) in a `threads` pool.

This makes tests run faster, but the VM module is unstable when running [ESM code](https://github.com/nodejs/node/issues/37648). Your tests will [leak memory](https://github.com/nodejs/node/issues/33439) - to battle that, consider manually editing [`vmMemoryLimit`](/config/vmmemorylimit) value.

::: warning
Running code in a sandbox has some advantages (faster tests), but also comes with a number of disadvantages.

- The globals within native modules, such as (`fs`, `path`, etc), differ from the globals present in your test environment. As a result, any error thrown by these native modules will reference a different Error constructor compared to the one used in your code:

```ts
try {
  fs.writeFileSync('/doesnt exist')
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
