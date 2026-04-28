---
title: Database Transaction per Test | Recipes
---

# Database Transaction per Test

Integration tests that touch a real database need to start from a clean state. Truncating tables between every test is slow, so the conventional workaround is to wrap each test in a transaction that's rolled back when it finishes. Nothing ever commits, and there's no per-test cleanup to write.

Vitest exposes this through [`aroundEach`](/api/hooks#aroundeach) <Version>4.1.0</Version> and a [scoped fixture](/guide/test-context#fixture-scopes) <Version>3.2.0</Version>.

## Pattern

```ts
import { test as baseTest } from 'vitest'
import { createTestDatabase } from './db.ts'

export const test = baseTest
  .extend('db', { scope: 'file' }, async ({}, { onCleanup }) => {
    const db = await createTestDatabase()
    onCleanup(() => db.close())
    return db
  })

test.aroundEach(async (runTest, { db }) => {
  await db.transaction(runTest)
})

test('insert user', async ({ db }) => {
  await db.insert({ name: 'Alice' })
  // rolled back automatically when the test ends
})
```

## How it works

The `db` fixture is created once per file via `scope: 'file'`, so connection setup happens once instead of on every test, and `onCleanup` closes the connection when the file is done. `aroundEach` wraps every test in `db.transaction(runTest)`, and anything the test writes gets rolled back when `runTest` resolves. The test receives the same `db` instance through its context, with no awareness that it's running inside a transaction.

This works as long as your database driver supports nested transactions or savepoints, which covers most modern databases. The same `aroundEach` hook can also wrap an [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) context if you want to propagate things like tenant or trace IDs through the test alongside the transaction.

## One connection per worker

If the suite has many files, paying for a fresh database connection on every file adds up. Switching the fixture to `scope: 'worker'` and turning off isolation lets multiple files share a single connection per worker process:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
  },
})
```

```ts
import { test as baseTest } from 'vitest'
import { createTestDatabase } from './db.ts'

export const test = baseTest
  .extend('db', { scope: 'worker' }, async ({}, { onCleanup }) => {
    const db = await createTestDatabase()
    onCleanup(() => db.close())
    return db
  })

test.aroundEach(async (runTest, { db }) => {
  await db.transaction(runTest)
})
```

By default, every test file runs in its own worker, so `scope: 'file'` and `scope: 'worker'` behave identically. With `isolate: false`, Vitest reuses workers across files (capped by [`maxWorkers`](/config/maxworkers)), so a worker-scoped fixture is created once per worker instead of once per file. For a suite of 200 files running on 8 workers, that's 8 connections instead of 200.

Reusing workers isn't a free optimization. With isolation off, files share module instances inside the worker, and tests that mutate top-level state (counters, caches, monkey-patched globals) can leak that state to whichever file runs next in the same worker. The per-test rollback handles data isolation in the database. It can't protect module state in the worker. Read the trade-offs in the [Per-File Isolation Settings](/guide/recipes/disable-isolation) recipe before turning isolation off suite-wide.

[`vmThreads` and `vmForks`](/config/pool) always run isolated regardless of the `isolate` flag, so worker-scoped fixtures fall back to per-file behavior in those pools.

## See also

- [`aroundEach` and `aroundAll`](/api/hooks#aroundeach)
- [Fixture scopes](/guide/test-context#fixture-scopes)
- [Builder pattern](/guide/test-context#builder-pattern)
