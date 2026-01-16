---
title: tags | Config
outline: deep
---

# tags <Version>4.1.0</Version> {#tags}

- **Type:** `TestTagDefinition[]`
- **Default:** `[]`

Defines all [available tags](/guide/test-tags) in your test project. If test defines a name not listed here, Vitest will throw an error.

If you are using [`projects`](/config/projects), they will inherit all global tags automatically.

To filter tags, you can pass them down as [`--tag`](/guide/cli#tag):

```shell
vitest --tag=frontend --tag=!backend
vitest --tag="unit/*"
```

::: tip FILTERING
You can use a wildcard (*) to match any number of symbols. To ignore a tag, add an exclamation mark (!) at the start of the tag.
:::

<!-- TODO: guide about tags, include that you can add tags as @tag pragma to mark all tests in a file with that tag, and mention `project.createSpecification` -->

## Example

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
