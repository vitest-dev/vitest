import type { ResolvedConfig, UserConfig } from '../types/config'

/**
 * Central declaration of how root-level configuration reaches project configs.
 *
 * Options travel from the root to a project through a fixed set of mechanisms,
 * each applied at a specific stage of config resolution. When adding an option
 * that needs special propagation behavior, declare it in the matching list:
 *
 * - `PROJECT_CLI_OVERRIDES`: CLI flags applied to every project (including
 *   file-based and `extends: false` ones) at the highest priority, via the
 *   `CliOverride` plugin.
 * - `RUN_LEVEL_OPTIONS`: options that only make sense for the test run as a
 *   whole; every project receives the root's resolved value at the end of
 *   `resolveTestConfig`.
 * - `REPLACED_OPTIONS`: options where the project's own value replaces the
 *   value merged from an extended config instead of being merged with it.
 * - `NON_INHERITED_OPTIONS` / `NON_INHERITED_ROOT_OPTIONS`: options an inline
 *   project never inherits from the config it extends, via the
 *   `vitest:project-inheritance` plugin.
 * - `NON_INHERITED_PROGRAMMATIC_OPTIONS`: `test` options an inline project
 *   never inherits from the programmatic config passed to `createVitest`,
 *   even though the rest of it is inherited like the root config file.
 *
 * `coverage` is also a run-level option, but it is not listed here: it is
 * assigned by reference early in `resolveTestConfig` because every project
 * appends its own files to the shared `coverage.exclude` array during
 * resolution.
 *
 * Every other option is inherited by extending inline projects through Vite's
 * `configFile` mechanism (the extended config file is re-executed for every
 * project) plus the programmatic config merge in `inheritRootViteOverrides`.
 */

// CLI options that can override per-project test config.
// Not all options are allowed to be overridden.
export const PROJECT_CLI_OVERRIDES = [
  'logHeapUsage',
  'detectAsyncLeaks',
  'allowOnly',
  'sequence',
  'testTimeout',
  'pool',
  'update',
  'globals',
  'expandSnapshotDiff',
  'disableConsoleIntercept',
  'retry',
  'repeats',
  'testNamePattern',
  'passWithNoTests',
  'bail',
  'isolate',
  'printConsoleTrace',
  'inspect',
  'inspectBrk',
  'fileParallelism',
  'tagsFilter',
  'browser',
  'experimental',
  'fsModuleCache',
  'fsModuleCachePath',
] as const satisfies readonly (keyof UserConfig)[]

// Options resolved once for the whole test run; the root's resolved value
// always overrides whatever the project resolved on its own.
export const RUN_LEVEL_OPTIONS = [
  'attachmentsDir',
  'mergeReportsLabel',
] as const satisfies readonly (keyof ResolvedConfig)[]

// The project's own value replaces the value merged from an extended config.
export const REPLACED_OPTIONS = [
  'tags',
] as const satisfies readonly (keyof UserConfig)[]

// `name` must stay unique per project, `projects` would redefine the whole workspace
export const NON_INHERITED_OPTIONS = [
  'name',
  'projects',
] as const satisfies readonly (keyof UserConfig)[]

// the root `globalSetup` already runs once per test run; a non-root
// config keeps it because nothing else runs it
export const NON_INHERITED_ROOT_OPTIONS = [
  'name',
  'projects',
  'globalSetup',
] as const satisfies readonly (keyof UserConfig)[]

// `test` options never inherited from the programmatic config:
// - `tagsFilter` is CLI-only; `PROJECT_CLI_OVERRIDES` applies it per project
// - `browser` describes the instances of a single project; inheriting it
//   would create duplicate instance names (the `--browser` flags have the
//   same guard in `CliOverride`)
export const NON_INHERITED_PROGRAMMATIC_OPTIONS = [
  'tagsFilter',
  'browser',
] as const satisfies readonly (keyof UserConfig)[]
