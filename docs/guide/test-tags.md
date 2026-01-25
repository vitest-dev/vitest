---
title: Test Tags | Guide
outline: deep
---

# Test Tags <Version>4.1.0</Version> {#test-tags}

[`Tags`](/config/tags) let you label tests so you can filter what runs and override their options when needed.

## Defining Tags

Tags must be defined in your configuration file — Vitest does not provide any built-in tags. If a test uses a tag that isn't defined in the config, the test runner will throw an error. This prevents unexpected behavior from mistyped tag names. You can disable this check with the [`strictTags`](/config/stricttags) option.

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
If several tags have the same options and are used on the same test, they will be resolved in the order they were specified, or sorted by priority first (the lower the number, the higher the priority). Tags without a defined priority are merged first and will be overriden by higher priority ones:

```ts
test('flaky database test', { tags: ['flaky', 'db'] })
// { timeout: 30_000, retry: 3 }
```

Note that the `timeout` is 30 seconds (and not 60) because `flaky` tag has a priority of `1` while `db` (that defines 60 second timeout) has no priority.

If test defines its own options, they will have the highest priority:

```ts
test('flaky database test', { tags: ['flaky', 'db'], timeout: 120_000 })
// { timeout: 120_000, retry: 3 }
```
:::

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

To see all your tags, you can use [`--list-tags`](/guide/cli#listtags) command:

```shell
vitest --list-tags

frontend: Tests written for frontend.
backend: Tests written for backend.
db: Tests for database queries.
flaky: Flaky CI tests.
```

To print it in JSON, pass down `--list-tags=json`:

```json
{
  "tags": [
    {
      "name": "frontend",
      "description": "Tests written for frontend."
    },
    {
      "name": "backend",
      "description": "Tests written for backend."
    },
    {
      "name": "db",
      "description": "Tests for database queries.",
      "timeout": 60000
    },
    {
      "name": "flaky",
      "description": "Flaky CI tests.",
      "retry": 0,
      "timeout": 30000,
      "priority": 1
    }
  ],
  "projects": []
}
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

It's also possible to define `tags` for every test in the file by using JSDoc's `@module-tag` at the top of the file:

```ts
/**
 * Auth tests
 * @module-tag admin/pages/dashboard
 * @module-tag acceptance
 */

test('dashboard renders items', () => {
  // ...
})
```

::: danger
A `@module-tag` in a JSDoc comment applies to all tests in that file, not just the test it precedes.

Consider this example:

```js{3,10}
describe('forms', () => {
  /**
   * @module-tag frontend
   */
  test('renders a form', () => {
    // ...
  })

  /**
   * @module-tag db
   */
  test('db returns users', () => {
    // ...
  })
})
```

In this example, every test in the file will have both the `frontend` and `db` tags. To tag individual tests, use the options argument instead:

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

To run only tests with specific tags, use the [`--tags-filter`](/guide/cli#tagsfilter) CLI option:

```shell
vitest --tags-filter=frontend
vitest --tags-filter="frontend and backend"
```

If you are running Vitest UI, you can start a filter with a `tag:` prefix to filter out tests by tags using the same tags expression sytax:

<img alt="The tags filter in Vitest UI" img-light src="/ui/light-ui-tags.png">
<img alt="The tags filter in Vitest UI" img-dark src="/ui/dark-ui-tags.png">

If you are using a programmatic API, you can pass down a `tagsFilter` option to [`startVitest`](/guide/advanced/#startvitest) or [`createVitest`](/guide/advanced/#createvitest):

```ts
import { startVitest } from 'vitest/node'

await startVitest('test', [], {
  tagsFilter: ['frontend and backend'],
})
```

Or you can create a [test specification](/api/advanced/test-specification) with your custom filters:

```ts
const specification = vitest.getRootProject().createSpecification(
  '/path-to-file.js',
  {
    testTagsFilter: ['frontend and backend'],
  },
)
```

### Syntax

You can combine tags in different ways. Vitest supports these keywords:

- `and` or `&&` to include both expressions
- `or` or `||` to include at least one expression
- `not` or `!` to exclude the expression
- `*` to match any number of characters (0 or more)
- `()` to group expressions and override precedence

The parser follows standard [operator precedence](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence): `not`/`!` has the highest priority, then `and`/`&&`, then `or`/`||`. Use parentheses to override default precedence.

::: warning Reserved Names
Tag names cannot be `and`, `or`, or `not` (case-insensitive) as these are reserved keywords. Tag names also cannot contain special characters (`(`, `)`, `&`, `|`, `!`, `*`, spaces) as these are used by the expression parser.
:::

### Wildcards

You can use a wildcard (`*`) to match any number of characters:

```shell
vitest --tags-filter="unit/*"
```

This will match tags like `unit/components`, `unit/utils`, etc.

### Excluding Tags

To exclude tests with a specific tag, add an exclamation mark (`!`) at the start or a "not" keyword:

```shell
vitest --tags-filter="!slow and not flaky"
```

### Examples

Here are some common filtering patterns:

```shell
# Run only unit tests
vitest --tags-filter="unit"

# Run tests that are both frontend AND fast
vitest --tags-filter="frontend and fast"

# Run tests that are either unit OR e2e
vitest --tags-filter="unit or e2e"

# Run all tests except slow ones
vitest --tags-filter="!slow"

# Run frontend tests that are not flaky
vitest --tags-filter="frontend && !flaky"

# Run tests matching a wildcard pattern
vitest --tags-filter="api/*"

# Complex expression with parentheses
vitest --tags-filter="(unit || e2e) && !slow"

# Run database tests that are either postgres or mysql, but not slow
vitest --tags-filter="db && (postgres || mysql) && !slow"
```

You can also pass multiple `--tags-filter` flags. They are combined with AND logic:

```shell
# Run tests that match (unit OR e2e) AND are NOT slow
vitest --tags-filter="unit || e2e" --tags-filter="!slow"
```
