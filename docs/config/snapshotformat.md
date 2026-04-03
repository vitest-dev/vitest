---
title: snapshotFormat | Config
outline: deep
---

# snapshotFormat <CRoot />

- **Type:** `Omit<PrettyFormatOptions, 'plugins' | 'compareKeys'> & { compareKeys?: null | undefined }`

Format options for snapshot testing. These options configure the snapshot-specific formatting layer built on top of [`@vitest/pretty-format`](https://npmx.dev/package/@vitest/pretty-format).

Vitest snapshots already apply these defaults before your `snapshotFormat` overrides:

- `printBasicPrototype: false`
- `escapeString: false`
- `escapeRegex: true`
- `printFunctionName: false`

The following options are commonly useful in `snapshotFormat`:

- Output shape: `indent`, `min`, `maxDepth`, `maxWidth`
- Escaping and display: `escapeRegex`, `escapeString`, `highlight`
- Object formatting: `callToJSON`, `printBasicPrototype`, `printFunctionName`
- Vitest-specific behavior: `printShadowRoot`, `maxOutputLength`

`printShadowRoot` controls whether shadow-root contents are included in DOM snapshots.

`maxOutputLength` is an approximate per-depth output budget, not a hard cap on the final rendered string.

By default, snapshot keys are sorted using the formatter's default behavior. Set `compareKeys` to `null` to disable key sorting. Custom compare functions are not supported in `snapshotFormat`.

::: tip
Beware that `plugins` on this object will be ignored.

If you need to extend snapshot serialization via pretty-format plugins, use [`expect.addSnapshotSerializer`](/api/expect#expect-addsnapshotserializer) or [`snapshotSerializers`](/config/snapshotserializers) instead.
:::
