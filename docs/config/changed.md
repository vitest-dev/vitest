---
title: changed | Config
outline: deep
---

### changed <CRoot />

- **Type:** `boolean | string`
- **Default:** `false`
- **CLI:** `--changed`, `--changed=HEAD~1`

Run tests only against changed files. If no value is provided, it will run tests against uncommitted changes (including staged and unstaged).

To run tests against changes made in the last commit, you can use `--changed HEAD~1`. You can also pass commit hash (e.g. `--changed 09a9920`) or branch name (e.g. `--changed origin/develop`).

When used with code coverage the report will contain only the files that were related to the changes.

Changes to files that every test file in a project depends on rerun all tests of that project: [`setupFiles`](/config/setupfiles), [`globalSetup`](/config/globalsetup), a custom [`runner`](/config/runner) or [`environment`](/config/environment), [`snapshotSerializers`](/config/snapshotserializers), the `.env` files loaded from [`envDir`](https://vite.dev/config/shared-options#envdir), and the project's config file with everything it imports. Vitest also follows the environment set in a `@vitest-environment` comment, the `__mocks__` files used by `vi.mock` calls without a factory, and the snapshot file of each test. Files passed to `toMatchFileSnapshot` are not tracked.

If paired with the [`forceRerunTriggers`](/config/forcereruntriggers) config option it will run the whole test suite if at least one of the files listed in the `forceRerunTriggers` list changes. By default, changes to the Vitest config file and `package.json` will always rerun the whole suite.
