---
title: taskTitleValueFormatTruncate | Config
outline: deep
---

# taskTitleValueFormatTruncate <CRoot /> {#tasktitlevalueformattruncate}

- **Type** `number`
- **Default:** `40`

Sets the length limit for formatted values interpolated into generated task titles.

This affects values inserted by APIs like `test.each` and `test.for`, including both `$value` and `%` placeholder formatting.

Set it to `0` to disable truncation.
