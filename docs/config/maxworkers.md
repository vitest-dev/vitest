---
title: maxWorkers | Config
outline: deep
---

# maxWorkers

- **Type:** `number | string`
- **Default:**
  - if [`watch`](/config/watch) is disabled, uses all available parallelism
  - if [`watch`](/config/watch) is enabled, uses half of all available parallelism

Defines the maximum concurrency for test workers. Accepts either a number or a percentage string.

- Number: spawns up to the specified number of workers.
- Percentage string (e.g., "50%"): computes the worker count as the given percentage of the machine’s available parallelism.

## Example

### Number

::: code-group
```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    maxWorkers: 4,
  },
})
```
```bash [CLI]
vitest --maxWorkers=4
```
:::

### Percent

::: code-group
```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    maxWorkers: '50%',
  },
})
```
```bash [CLI]
vitest --maxWorkers=50%
```
:::

Vitest uses [`os.availableParallelism`](https://nodejs.org/api/os.html#osavailableparallelism) to know the maximum amount of parallelism available.
