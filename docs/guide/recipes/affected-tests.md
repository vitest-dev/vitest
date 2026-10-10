---
title: Running Only Affected Tests | Recipes
---

# Running Only Affected Tests

A full run of a large suite is the right check before a merge, but it is slow feedback for a small change. If you edited one module, only the tests that load that module can change their result. Vitest has two flags that select those tests. They differ in one question: changed compared to what?

- [`--changed`](/config/changed) compares the working tree with a Git reference.
- [`--stale`](/config/stale) compares every file a test loaded with the time of the test's last run.

## `--changed`: what differs from a Git reference

```sh
vitest run --changed              # uncommitted changes, staged and unstaged
vitest run --changed HEAD~1       # the last commit and uncommitted changes
vitest run --changed origin/main  # everything on this branch
```

Vitest asks Git for the changed files, then finds the test files that import them, directly or through other modules. A test runs when any file in its import graph is in the list.

The reference is the baseline, so the same command gives the same selection until the baseline moves. This fits checks that are defined in terms of Git: a pull request against `origin/main`, or a pre-push hook that covers the commits you are about to push. It requires a Git repository, and a change that is committed and merged stops being "changed", even if the tests never ran against it on your machine.

## `--stale`: what changed since the test last ran

```sh
vitest run --stale
```

The first run with `--stale` runs every test and records the files each test loaded, including dynamic imports, mocks, setup files and snapshot files. Every later run compares the modification time of those files with the time of the run that recorded them. A test is stale when one of its files is newer or was deleted, or when the test has no record yet.

Each run updates the records of the tests it ran, so the baseline moves with you: after a stale run, only the next edit makes tests stale again. Git is not involved, so the flag works in a fresh container, in a worktree with an unrelated history, or in a directory that is not a repository. A new test file, or one that was never recorded, always runs.

The records live in the [cache](/config/cache). `vitest run --clearCache` deletes them, and the next `--stale` run is a full run again.

## Which one to pick

| You want to run the tests affected by…                                 | Use                      |
| ---------------------------------------------------------------------- | ------------------------ |
| a branch, before opening or updating a pull request                    | `--changed origin/main`  |
| the commits you are about to push                                      | `--changed <upstream>`   |
| your uncommitted edits, in a Git repository                            | `--changed` or `--stale` |
| your edits since you last ran the tests, committed or not              | `--stale`                |
| edits in a directory without Git, or with a history you do not control | `--stale`                |

`--changed` is the better fit when the baseline is shared with other people: the reference is the same on every machine and in CI. `--stale` is the better fit when the baseline is your own last run: it does not matter whether you committed in between, or whether Git is there at all.

## Agents

AI coding agents run tests after almost every edit. They often work in a container or a temporary worktree, commit in the middle of a task, and start a new process for every command. A Git baseline fits none of that: `--changed` is empty right after a commit, and it needs a repository. `--stale` tracks what the agent actually ran, so each `vitest run --stale` covers exactly the edits since the previous one, and the first command in a fresh environment is a full run that builds the records.

Tell the agent about it in the instructions file of your project:

```md [AGENTS.md]
- After a change, run `vitest run --stale` to test only what the change affects.
- Before you finish, run `vitest run` once for the whole suite.
```

Two things the records cannot see: a file that no test loaded during the last run (a new `.env` file, a new `__mocks__` file), and modification times set in the past by a checkout or an unpacked archive. The full run at the end covers both.

## See also

- [`changed`](/config/changed)
- [`stale`](/config/stale)
- [`experimental.recordDependencies`](/config/experimental#experimental-recorddependencies)
- [Test Filtering](/guide/filtering)
