---
title: artifactsDir | Config
outline: deep
---

# artifactsDir <CRoot />

- **Type:** `string`
- **Default:** `'.vitest'`

Root directory for shared artifacts that Vitest creates through [`vitest.createReport()`](/api/advanced/vitest#createreport) — for example the blob reports written by `--reporter=blob`, and the default location of the [HTML report](/guide/reporters#html-reporter).

Explicit output paths still take precedence. When they are not set, they default underneath this directory: [`attachmentsDir`](/config/attachmentsdir) defaults to `<artifactsDir>/attachments`.

This option is resolved relative to the root Vitest config. When using [`projects`](/guide/projects), all projects share the same `artifactsDir`; it cannot be configured per project.

::: tip
This mirrors [`coverage.reportsDirectory`](/config/#coverage-reportsdirectory): pointing `artifactsDir` at a directory you already git-ignore keeps every Vitest artifact under one root instead of adding a new ignore entry per project.
:::
