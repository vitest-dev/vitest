---
title: restoreMocks | Config
outline: deep
---

# restoreMocks

- **Type:** `boolean`
- **Default:** `false`

Will call [`vi.restoreAllMocks()`](/api/vi#vi-restoreallmocks) before each test.

This restores all original implementations on spies created with [`vi.spyOn`](#vi-spyon).
