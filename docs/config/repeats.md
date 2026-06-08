---
title: repeats | Config
outline: deep
---

# repeats

- **Type:** `number`
- **Default:** `0`
- **CLI:** `--repeats=<number>`

Repeat every test a specific number of times regardless of the result. A test that uses the [`repeats`](/api/test#repeats) test option takes precedence over this value.

This is useful for verifying that tests are stable across multiple runs. If a test fails on any repetition, the whole test is reported as failed.
