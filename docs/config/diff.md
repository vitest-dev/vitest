---
title: diff | Config
outline: deep
---

# diff

- **Type:** `string`
- **CLI:** `--diff=<path>`

`DiffOptions` object or a path to a module which exports `DiffOptions`. Useful if you want to customize diff display.

For example, as a config object:

```ts
import { defineConfig } from 'vitest/config'
import c from 'picocolors'

export default defineConfig({
  test: {
    diff: {
      aIndicator: c.bold('--'),
      bIndicator: c.bold('++'),
      omitAnnotationLines: true,
    },
  },
})
```

Or as a module:

:::code-group
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    diff: './vitest.diff.ts',
  },
})
```

```ts [vitest.diff.ts]
import type { DiffOptions } from 'vitest'
import c from 'picocolors'

export default {
  aIndicator: c.bold('--'),
  bIndicator: c.bold('++'),
  omitAnnotationLines: true,
} satisfies DiffOptions
```
:::

## diff.expand

- **Type**: `boolean`
- **Default**: `true`
- **CLI:** `--diff.expand=false`

Expand all common lines.

## diff.truncateThreshold

- **Type**: `number`
- **Default**: `0`
- **CLI:** `--diff.truncateThreshold=<path>`

The maximum length of diff result to be displayed. Diffs above this threshold will be truncated.
Truncation won't take effect with default value 0.

## diff.truncateAnnotation

- **Type**: `string`
- **Default**: `'... Diff result is truncated'`
- **CLI:** `--diff.truncateAnnotation=<annotation>`

Annotation that is output at the end of diff result if it's truncated.

## diff.truncateAnnotationColor

- **Type**: `DiffOptionsColor = (arg: string) => string`
- **Default**: `noColor = (string: string): string => string`

Color of truncate annotation, default is output with no color.

## diff.printBasicPrototype

- **Type**: `boolean`
- **Default**: `false`

Print basic prototype `Object` and `Array` in diff output

## diff.maxDepth

- **Type**: `number`
- **Default**: `20` (or `8` when comparing different types)

Limit the depth to recurse when printing nested objects
