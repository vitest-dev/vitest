Tests are split by categories. Default categories are:

## unit

These tests are running in different pools with a single config file. If you just need to test a function call, you can place your test here.

This is the only test category that doesn't start new Vitest instance for every test.

## e2e

If you are testing a complex interaction, place your tests here.

- Config options go to `test/e2e/test/config/`.
- Vitest behaviour when file is created/updated/removed goes to `test/e2e/test/watch/`.
- Type-focused fixtures live under `test/e2e/dts/`.

## browser

If you are testing browser mode, add your tests here.

## ui

These are e2e tests for UI package. We are using `playwright` to test it.

---

All other categories just group tests by type.
