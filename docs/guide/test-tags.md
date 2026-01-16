# Test Tags <Version>4.1.0</Version>

[`Tags`](/config/tags) allow you to mark tests and change their options based on the tag's definition.

## Defining Tags

Tags must be defined in your configuration file. Vitest does not provide any built-in tags. The test runner will throw an error if a test uses a tag not defined in the config.

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
    ],
  },
})
```

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

It's also possible to define `tags` for every test in the file by using JSDoc's `@tag`:

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
