---
title: attachmentsDir | Config
outline: deep
---

# attachmentsDir <CRoot />

- **Type:** `string`
- **Default:** `'.vitest/attachments'`

Directory path for storing file attachments created by [`context.annotate`](/guide/test-context#annotate).

This option is resolved relative to the root Vitest config. When using [`projects`](/guide/projects), all projects share the same `attachmentsDir`; it cannot be configured per project.
