---
title: snapshotFormat | Config
outline: deep
---

# snapshotFormat <CRoot />

- **Type:** `PrettyFormatOptions`

Format options for snapshot testing. These options are passed down to our fork of [`pretty-format`](https://www.npmjs.com/package/pretty-format). In addition to the `pretty-format` options we support `printShadowRoot: boolean`.

::: tip
Beware that `plugins` field on this object will be ignored.

If you need to extend snapshot serializer via pretty-format plugins, please, use [`expect.addSnapshotSerializer`](/api/expect#expect-addsnapshotserializer) API or [snapshotSerializers](#snapshotserializers) option.
:::
