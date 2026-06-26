---
title: timeout | Config
outline: deep
---

# timeout

- **Type:** `object`

Unified timeout configuration. This namespace groups all timeouts in one place and supersedes the standalone [`testTimeout`](/config/testtimeout), [`hookTimeout`](/config/hooktimeout), [`teardownTimeout`](/config/teardowntimeout) and `expect.poll.timeout` options (which remain as deprecated aliases).

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    timeout: {
      test: 5_000,
      hook: 10_000,
      teardown: 10_000,
      action: 'auto',
      poll: 1_000,
      wait: 1_000,
    },
  },
})
```

## How `'auto'` and the budget work

Per-operation timeouts (`action`, `poll`, `wait`) are always clamped to the **remaining test (or hook) budget**, so an operation fails *just before* the test itself times out — producing a descriptive, source-mapped error instead of a generic "test timed out". A per-call `timeout` option is clamped the same way.

- `'auto'` — ride the remaining test budget (no fixed timeout of its own).
- `<number>` — a fixed cap *below* the budget; the operation fails at `min(remaining budget, <number>)`.

When there is no test budget (outside a test, or when the test timeout is disabled), `'auto'` falls back to a fixed default.

## timeout.test

- **Type:** `number`
- **Default:** `5_000` in Node.js, `15_000` if `browser.enabled` is `true`
- **CLI:** `--timeout.test=5000`

Default timeout of a test in milliseconds. Use `0` to disable timeout completely. Replaces [`testTimeout`](/config/testtimeout).

## timeout.hook

- **Type:** `number`
- **Default:** `10_000` in Node.js, `30_000` if `browser.enabled` is `true`
- **CLI:** `--timeout.hook=10000`

Default timeout of a hook in milliseconds. Use `0` to disable timeout completely. Replaces [`hookTimeout`](/config/hooktimeout).

## timeout.teardown

- **Type:** `number`
- **Default:** `10_000`
- **CLI:** `--timeout.teardown=10000`

Default timeout to wait for close when Vitest shuts down, in milliseconds. Replaces [`teardownTimeout`](/config/teardowntimeout).

## timeout.action

- **Type:** `number | 'auto'`
- **Default:** `'auto'`
- **CLI:** `--timeout.action=5000`

Timeout for browser actions, locator interactions and `expect.element()`. Defaults to `'auto'` (rides the test budget). A provider-level `browser.providerOptions.actionTimeout` continues to work as an override; the budget clamp still applies on top.

## timeout.poll

- **Type:** `number | 'auto' | { timeout?: number | 'auto'; interval?: number }`
- **Default:** `1_000`
- **CLI:** `--timeout.poll.timeout=1000`, `--timeout.poll.interval=50`

Default timeout for [`expect.poll()`](/api/expect#poll). Replaces `expect.poll.timeout`. Use `'auto'` to ride the test budget instead of a fixed timeout. The object form also sets the polling `interval` (default `50`).

## timeout.wait

- **Type:** `number | 'auto' | { timeout?: number | 'auto'; interval?: number }`
- **Default:** `1_000`
- **CLI:** `--timeout.wait.timeout=1000`, `--timeout.wait.interval=50`

Default timeout for [`vi.waitFor()`](/api/vi#vi-waitfor) and [`vi.waitUntil()`](/api/vi#vi-waituntil). Use `'auto'` to ride the test budget instead of a fixed timeout. The object form also sets the polling `interval` (default `50`).
