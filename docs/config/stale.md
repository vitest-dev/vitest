---
title: stale | Config
outline: deep
---

### stale <CRoot /> <Version type="experimental">5.1.0</Version> {#stale}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--stale`

Run only the tests whose dependencies were modified since the last run of the test. A test is stale when one of the files it loaded during its last run has a newer modification time than that run, or was deleted. A test that never ran with this option has no record and always runs.

```sh
vitest run --stale
```

Every run with this option updates the records of the tests it ran, so the next run selects only the tests affected by changes made in between. To run every test again, run Vitest without the flag, or delete the cache with [`--clearCache`](/guide/cli#clearcache).

The option requires [`cache`](/config/cache). Vitest throws an error if the cache is disabled.

::: warning
The modification time comes from the file system. A `git checkout` or an unpacked archive that sets old modification times is not detected. Files that a test did not load during its last run, for example a new `.env` file or a new `__mocks__` file, are not detected either. See [`experimental.recordDependencies`](/config/experimental#experimental-recorddependencies) for the full list of recorded files.
:::
