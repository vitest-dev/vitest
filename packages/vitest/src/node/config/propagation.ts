import type { ResolvedConfig, UserConfig } from '../types/config'

/**
 * Central declaration of how root-level configuration reaches project configs.
 *
 * Options travel from the root to a project through a fixed set of mechanisms,
 * each applied at a specific stage of config resolution. When adding an option
 * that projects must receive, declare it in the matching list here:
 *
 * - `PROJECT_CLI_OVERRIDES`: CLI flags applied to every project (including
 *   file-based ones) at the highest priority, via the `CliOverride` plugin.
 * - `ROOT_DEFAULT_OPTIONS` / `ROOT_DEFAULT_EXPERIMENTAL_OPTIONS`: root config
 *   values applied as per-project defaults even without `extends: true`, via
 *   the `vitest:project` plugin's `config` hook.
 * - `RUN_LEVEL_OPTIONS`: options that only make sense for the test run as a
 *   whole; every project receives the root's resolved value at the end of
 *   `resolveTestConfig`.
 * - `REPLACED_OPTIONS`: options where the project's own value replaces the
 *   value merged from an extended config instead of being merged with it, via
 *   the `vitest:project-config` plugin.
 *
 * `coverage` is also a run-level option, but it is not listed here: it is
 * assigned by reference early in `resolveTestConfig` because every project
 * appends its own files to the shared `coverage.exclude` array during
 * resolution.
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
] as const satisfies readonly (keyof UserConfig)[]

// Root values applied as per-project defaults even without `extends: true`.
export const ROOT_DEFAULT_OPTIONS = [
  'fsModuleCache',
  'fsModuleCachePath',
] as const satisfies readonly (keyof UserConfig)[]

export const ROOT_DEFAULT_EXPERIMENTAL_OPTIONS = [
  'viteModuleRunner',
  'nodeLoader',
  'importDurations',
] as const satisfies readonly (keyof NonNullable<UserConfig['experimental']>)[]

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
