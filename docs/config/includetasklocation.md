---
title: includeTaskLocation | Config
outline: deep
---

# includeTaskLocation

- **Type:** `boolean`
- **Default:** `false`

Should `location` property be included when Vitest API receives tasks in [reporters](#reporters). If you have a lot of tests, this might cause a small performance regression.

The `location` property has `column` and `line` values that correspond to the `test` or `describe` position in the original file.

This option will be auto-enabled if you don't disable it explicitly, and you are running Vitest with:
- [Vitest UI](/guide/ui)
- or using the [Browser Mode](/guide/browser/) without [headless](/guide/browser/#headless) mode
- or using [HTML Reporter](/guide/reporters#html-reporter)

::: tip
This option has no effect if you do not use custom code that relies on this.
:::
