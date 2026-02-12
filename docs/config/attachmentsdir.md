---
title: attachmentsDir | Config
outline: deep
---

# attachmentsDir

- **Type:** `string`
- **Default:** `'.vitest-attachments'`

Directory path for storing attachments created by [`context.annotate`](/guide/test-context#annotate) relative to the project root.

When using [`--reporter=blob`](/guide/reporters#blob-reporter) with [`--merge-reports`](/guide/cli#merge-reports) across CI jobs, make sure this directory is uploaded and restored together with blob reports.
