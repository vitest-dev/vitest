---
title: Test Tags | Guide
---

# Test Tags <Version>4.1.0</Version>

[`Tags`](/config/tags) allow you to mark tests and change their options based on the tag's definition.

## Defining Tags

Tags must be defined in your configuration file. Vitest does not provide any built-in tags. The test runner will throw an error if a test uses a tag not defined in the config in order to avoid silently doing something surprising due to mistyped names, but you can disable this behaviour via a [`strictTags`](/config/stricttags) option.

You must define a `name` of the tag, and you may define additional options that will be applied to every test marked with the tag, e.g., a `timeout`, or `retry`. For the full list of available options, see [`tags`](/config/tags).

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      {
        name: 'frontend',
        description: 'Tests written for frontend.',
      },
      {
        name: 'backend',
        description: 'Tests written for backend.',
      },
      {
        name: 'db',
        description: 'Tests for database queries.',
        timeout: 60_000,
      },
      {
        name: 'flaky',
        description: 'Flaky CI tests.',
        retry: process.env.CI ? 3 : 0,
        timeout: 30_000,
        priority: 1,
      },
    ],
  },
})
```

::: warning
If several tags have the same options and are applied to the same test, they will be resolved in order of application or sorted by `properity` first (the lower the number, the higher the priority is):

```ts
tet('flaky database test', { tags: ['flaky', 'db'] })
// { timeout: 30_000, retry: 3 }
```

Note that the `timeout` is 30 seconds (and not 60) because `flaky` tag has a priority of `1` while `db` (that defines 60 second timeout) has no priority.

If test defines its own options, they will have the highest priority:

```ts
tet('flaky database test', { tags: ['flaky', 'db'], timeout: 120_000 })
// { timeout: 120_000, retry: 3 }
```
:::

## Using Tags in Tests

You can apply tags to individual tests or entire suites using the `tags` option:

```ts
import { describe, test } from 'vitest'

test('renders homepage', { tags: ['frontend'] }, () => {
  // ...
})

describe('API endpoints', { tags: ['backend'] }, () => {
  test('returns user data', () => {
    // This test inherits the "backend" tag from the parent suite
  })

  test('validates input', { tags: ['validation'] }, () => {
    // This test has both "backend" (inherited) and "validation" tags
  })
})
```

Tags are inherited from parent suites, so all tests inside a tagged `describe` block will automatically have that tag.

It's also possible to define `tags` for every test in the file by using JSDoc's `@tag` at the top of the file:

```ts
/**
 * Auth tests
 * @tag admin/pages/dashboard
 * @tag acceptance
 */

test('dashboard renders items', () => {
  // ...
})
```

::: danger
Any JSDoc comment with a `@tag` will add that tag to all tests in that file. Putting it before the test does not mark that test with a tag:

```js{3,10}
describe('forms', () => {
  /**
   * @tag frontend
   */
  test('renders a form', () => {
    // ...
  })

  /**
   * @tag db
   */
  test('db returns users', () => {
    // ...
  })
})
```

This test file will mark all tests with a `frontend` and a `db` tag, you should pass an object instead:

```js{2,6}
describe('forms', () => {
  test('renders a form', { tags: 'frontend' }, () => {
    // ...
  })

  test('db returns users', { tags: 'db' }, () => {
    // ...
  })
})
```
:::

## Filtering Tests by Tag

To run only tests with specific tags, use the [`--tag`](/guide/cli#tag) CLI option:

```shell
vitest --tag=frontend
vitest --tag=frontend --tag=backend
```

If you are using a programmatic API, you can pass down a `tag` option to [`startVitest`](/guide/advanced/#startvitest) or [`createVitest`](/guide/advanced/#createvitest):

```ts
import { startVitest } from 'vitest/node'

await startVitest('test', [], {
  tag: ['frontend', 'backend'],
})
```

Or you can create a [test specification](/api/advanced/test-specification) with tags of your choice:

```ts
const specification = vitest.getRootProject().createSpecification(
  '/path-to-file.js',
  {
    testTags: ['frontend', 'backend'],
  },
)
```

::: warning
Note that `createSpecification` does not support wildcards and will not validate if the tags are defined in the config.
:::

### Wildcards

You can use a wildcard (`*`) to match any number of characters:

```shell
vitest --tag="unit/*"
```

This will match tags like `unit/components`, `unit/utils`, etc.

### Excluding Tags

To exclude tests with a specific tag, add an exclamation mark (`!`) at the start:

```shell
vitest --tag=frontend --tag=!slow
```

This runs all tests tagged with `frontend` except those also tagged with `slow`. Note that wildcard syntax is also supported for excluded tags:

```shell
vitest --tag="!unit/*"
```
