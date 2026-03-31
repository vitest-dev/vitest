---
title: blobLabel | Config
---

# blobLabel <CRoot />

- **Type:** `string`
- **CLI:** `--blobLabel=<label>`

Label for the current test run. When set, the label is displayed alongside test results in the reporter output, and stored in the blob when using [`--reporter=blob`](/guide/reporters#blob-reporter).

During [`--merge-reports`](/guide/cli#merge-reports), results from the same test files with different labels are kept as separate entries. The label is also included in the default blob output filename (e.g. `blob-linux.json`) to avoid collisions between runs on different machines.

## Example

::: code-group
```bash [CLI]
# on linux
vitest run --reporter=blob --blobLabel=linux

# on macos
vitest run --reporter=blob --blobLabel=macos
```
```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    blobLabel: process.env.OS_LABEL,
    reporters: ['blob'],
  },
})
```
:::

When merging, each label is displayed as a separate entry in the reporter output:

```sh
vitest --merge-reports

 ✓  linux  src/basic.test.ts (2 tests)
 ✓  macos  src/basic.test.ts (2 tests)
```

See [Blob Reporter](/guide/reporters#blob-reporter) and the [CI setup guide](/guide/improving-performance#sharding) for a full example.
