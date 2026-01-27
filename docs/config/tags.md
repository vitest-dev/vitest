---
title: tags | Config
outline: deep
---

# tags <Version>4.1.0</Version> {#tags}

- **Type:** `TestTagDefinition[]`
- **Default:** `[]`

Defines all [available tags](/guide/test-tags) in your test project. By default, if test defines a name not listed here, Vitest will throw an error, but this can be configured via a [`strictTags`](/config/stricttags) option.

If you are using [`projects`](/config/projects), they will inherit all global tags definitions automatically.

Use [`--tags-filter`](/guide/test-tags#syntax) to filter tests by their tags. Use [`--list-tags`](/guide/cli#listtags) to print every tag in your Vitest workspace.

## name

- **Type:** `string`
- **Required:** `true`

The name of the tag. This is what you use in the `tags` option in tests.

```ts
export default defineConfig({
  test: {
    tags: [
      { name: 'unit' },
      { name: 'e2e' },
    ],
  },
})
```

::: tip
If you are using TypeScript, you can enforce what tags are available by augmenting the `TestTags` type with a property that contains a union of strings (make sure this file is included by your `tsconfig`):

```ts [vitest.shims.ts]
import 'vitest'

declare module 'vitest' {
  interface TestTags {
    tags:
      | 'frontend'
      | 'backend'
      | 'db'
      | 'flaky'
  }
}
```
:::

## description

- **Type:** `string`

A human-readable description for the tag. This will be shown in UI and inside error messages when a tag is not found.

```ts
export default defineConfig({
  test: {
    tags: [
      {
        name: 'slow',
        description: 'Tests that take a long time to run.',
      },
    ],
  },
})
```

## priority

- **Type:** `number`
- **Default:** `Infinity`

Priority for merging options when multiple tags with the same options are applied to a test. Lower number means higher priority (e.g., priority `1` takes precedence over priority `3`).

```ts
export default defineConfig({
  test: {
    tags: [
      {
        name: 'flaky',
        timeout: 30_000,
        priority: 1, // higher priority
      },
      {
        name: 'db',
        timeout: 60_000,
        priority: 2, // lower priority
      },
    ],
  },
})
```

When a test has both tags, the `timeout` will be `30_000` because `flaky` has a higher priority.

## Test Options

Tags can define [test options](/api/test#test-options) that will be applied to every test marked with the tag. These options are merged with the test's own options, with the test's options taking precedence.

::: warning
The [`retry.condition`](/api/test#retry) can onle be a regexp because the config values need to be serialised.

Tags also cannot apply other [tags](/api/test#tags) via these options.
:::

## Example

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      {
        name: 'unit',
        description: 'Unit tests.',
      },
      {
        name: 'e2e',
        description: 'End-to-end tests.',
        timeout: 60_000,
      },
      {
        name: 'flaky',
        description: 'Flaky tests that need retries.',
        retry: process.env.CI ? 3 : 0,
        priority: 1,
      },
      {
        name: 'slow',
        description: 'Slow tests.',
        timeout: 120_000,
      },
      {
        name: 'skip-ci',
        description: 'Tests to skip in CI.',
        skip: !!process.env.CI,
      },
    ],
  },
})
```
