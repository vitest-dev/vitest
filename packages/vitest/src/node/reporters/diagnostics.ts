const DOM_ENVIRONMENTS = new Set(['jsdom', 'happy-dom'])

/** Minimum summed environment setup time before the hint is worth printing. */
const MIN_ENVIRONMENT_TIME = 2_000
/** Minimum share of the project's tracked time spent setting up environments. */
const MIN_ENVIRONMENT_SHARE = 0.25

/**
 * A hint has to be worth acting on: the estimated saving must be noticeable.
 * Run-to-run noise of real suites is commonly a few percent, so anything below
 * ~5% of the wall time cannot even be confirmed by trying the change - except
 * on long runs, where 10 seconds is worth attention regardless of percentage.
 */
export function isSavingWorthHinting(saving: number, executionTime: number): boolean {
  if (saving < 250) {
    return false
  }
  return saving >= executionTime * 0.05 || saving >= 10_000
}

export interface EnvironmentDiagnosticInput {
  name: string
  environment: string
  pool: string
  isolate: boolean
  browser: boolean
  /** The user explicitly configured the pool, so don't suggest changing it. */
  poolProvided: boolean
  /** The user explicitly configured isolation, so don't suggest disabling it. */
  isolateProvided: boolean
  /** Summed time spent creating the environment, across all files. */
  environmentTime: number
  /** Number of files that created an environment. */
  environmentCount: number
  /** Summed time of all tracked phases of this project. */
  trackedTime: number
  /** How many workers the environment setups were spread across. */
  parallelism: number
  /** Wall time of the whole run. */
  executionTime: number
}

export interface EnvironmentDiagnostic {
  name: string
  environment: string
  environmentTime: number
  environmentCount: number
  /** Share of the project's tracked time, 0-1. */
  share: number
  /** Whether suggesting `isolate: false` is appropriate. */
  suggestIsolate: boolean
}

/** Minimum summed import time before the hint is worth printing. */
const MIN_IMPORT_TIME = 2_000
/** Minimum share of the project's tracked time spent importing modules. */
const MIN_IMPORT_SHARE = 0.25
/**
 * Minimum fraction of module fetches that re-evaluate an already evaluated
 * module. Below this the test files import mostly disjoint graphs and
 * reusing workers would not meaningfully reduce the import work.
 */
const MIN_IMPORT_DUPLICATION = 0.2

export interface ImportDiagnosticInput {
  name: string
  pool: string
  isolate: boolean
  browser: boolean
  /** The user explicitly configured isolation, so don't suggest disabling it. */
  isolateProvided: boolean
  /** Summed time spent importing test files and their module graphs. */
  importTime: number
  /** Summed time of all tracked phases of this project. */
  trackedTime: number
  /**
   * How many times each module was served to a worker. With `isolate: true`
   * every test file re-fetches (and re-evaluates) its whole module graph, so
   * counts above the worker parallelism are repeated evaluations of the same
   * module that `isolate: false` would avoid.
   */
  fetchCounts: number[]
  fileCount: number
  /** How many workers the imports were spread across. */
  parallelism: number
  /** Wall time of the whole run. */
  executionTime: number
}

export interface ImportDiagnostic {
  name: string
  importTime: number
  /** Share of the project's tracked time, 0-1. */
  share: number
  totalFetches: number
  uniqueModules: number
  /** Fraction of fetches that re-evaluated an already evaluated module, 0-1. */
  duplication: number
  /** Estimated wall-clock saving of `isolate: false`. */
  estimatedSaving: number
}

/**
 * Detects projects where test files repeatedly evaluate the same module
 * graph. Typical for barrel-file imports: every test file pulls hundreds of
 * shared modules to use a few of them, and `isolate: true` re-evaluates that
 * graph for every file. The duplication is measured from the server-side
 * fetch counts, so suites with disjoint per-file graphs - where reusing
 * workers would not help - stay quiet.
 */
export function getImportDiagnostics(
  projects: ImportDiagnosticInput[],
): ImportDiagnostic[] {
  const diagnostics: ImportDiagnostic[] = []
  for (const project of projects) {
    if (
      // vm pools re-create the module graph per VM context regardless of
      // `isolate`, so reusing workers would not reduce the import work
      (project.pool !== 'forks' && project.pool !== 'threads')
      || !project.isolate
      || project.isolateProvided
      || project.browser
      || project.fileCount <= project.parallelism
      || project.importTime < MIN_IMPORT_TIME
      || project.trackedTime <= 0
      || project.importTime / project.trackedTime < MIN_IMPORT_SHARE
    ) {
      continue
    }
    const parallelism = Math.max(1, project.parallelism)
    let totalFetches = 0
    let avoidableFetches = 0
    for (const count of project.fetchCounts) {
      totalFetches += count
      // reused workers still fetch a module once per lane that needs it
      avoidableFetches += Math.max(0, count - parallelism)
    }
    if (totalFetches === 0) {
      continue
    }
    const duplication = avoidableFetches / totalFetches
    if (duplication < MIN_IMPORT_DUPLICATION) {
      continue
    }
    // imports are spread across the worker lanes, so the reducible wall time
    // is the duplicated share of the summed import time divided by lanes
    const estimatedSaving = (project.importTime * duplication) / parallelism
    if (!isSavingWorthHinting(estimatedSaving, project.executionTime)) {
      continue
    }
    diagnostics.push({
      name: project.name,
      importTime: project.importTime,
      share: project.importTime / project.trackedTime,
      totalFetches,
      uniqueModules: project.fetchCounts.length,
      duplication,
      estimatedSaving,
    })
  }
  return diagnostics
}

/**
 * Estimates the wall-clock time saved by evaluating shared modules once per
 * worker instead of once per test file. `moduleSelfTimes` holds, per module,
 * the module's own evaluation time in every test file that evaluated it.
 * Reused workers keep ~`parallelism` evaluations of each module (one per
 * lane); the rest of the summed time is avoidable and spread across the
 * lanes.
 */
export function estimateModuleEvaluationSaving(
  moduleSelfTimes: Iterable<number[]>,
  parallelism: number,
): number {
  const lanes = Math.max(1, parallelism)
  let avoidable = 0
  for (const times of moduleSelfTimes) {
    if (times.length <= lanes) {
      continue
    }
    let sum = 0
    for (const time of times) {
      sum += time
    }
    avoidable += (sum * (times.length - lanes)) / times.length
  }
  return avoidable / lanes
}

/** Minimum summed transform time before the hint is worth printing. */
const MIN_TRANSFORM_TIME = 2_000
/** Minimum share of the project's tracked time spent transforming modules. */
const MIN_TRANSFORM_SHARE = 0.25

export interface TransformDiagnosticInput {
  name: string
  /** Summed time spent transforming and serving modules. */
  transformTime: number
  /** Summed time of all tracked phases of this project. */
  trackedTime: number
  /** The fs module cache is already enabled - transforms persist across runs. */
  fsModuleCache: boolean
  /** The user explicitly configured the cache, so don't suggest enabling it. */
  fsModuleCacheProvided: boolean
  /** Wall time of the whole run. */
  executionTime: number
}

export interface TransformDiagnostic {
  name: string
  transformTime: number
  /** Share of the project's tracked time, 0-1. */
  share: number
}

/**
 * Detects projects that spend the run transforming modules. Without the fs
 * module cache every `vitest run` starts from scratch and transforms the
 * whole module graph again; `fsModuleCache` persists the results on disk so
 * repeated runs skip them.
 */
export function getTransformDiagnostics(
  projects: TransformDiagnosticInput[],
): TransformDiagnostic[] {
  return projects
    .filter((project) => {
      if (
        project.fsModuleCache
        || project.fsModuleCacheProvided
        || project.transformTime < MIN_TRANSFORM_TIME
        || project.trackedTime <= 0
        || project.transformTime / project.trackedTime < MIN_TRANSFORM_SHARE
      ) {
        return false
      }
      // the next run skips the persisted transforms, so the (mostly serial,
      // main-thread) transform time itself bounds the saving
      return isSavingWorthHinting(project.transformTime, project.executionTime)
    })
    .map(project => ({
      name: project.name,
      transformTime: project.transformTime,
      share: project.transformTime / project.trackedTime,
    }))
}

/**
 * Detects projects where re-creating a DOM environment for every test file
 * dominates the run. With an isolating pool the environment is set up once
 * per file; `vmThreads`/`vmForks` set it up once per worker while still
 * giving every file a fresh VM context.
 */
export function getEnvironmentDiagnostics(
  projects: EnvironmentDiagnosticInput[],
): EnvironmentDiagnostic[] {
  return projects
    .filter((project) => {
      if (
        !DOM_ENVIRONMENTS.has(project.environment)
        || (project.pool !== 'forks' && project.pool !== 'threads')
        || !project.isolate
        || project.browser
        || project.poolProvided
        || project.environmentCount <= 1
        || project.environmentTime < MIN_ENVIRONMENT_TIME
        || project.trackedTime <= 0
        || project.environmentTime / project.trackedTime < MIN_ENVIRONMENT_SHARE
      ) {
        return false
      }
      // setups are spread across the worker lanes; a vm pool would still pay
      // one setup per lane, so the reducible wall time is the rest
      const parallelism = Math.max(1, project.parallelism)
      const saving
        = project.environmentTime / parallelism
          - project.environmentTime / project.environmentCount
      return isSavingWorthHinting(saving, project.executionTime)
    })
    .map(project => ({
      name: project.name,
      environment: project.environment,
      environmentTime: project.environmentTime,
      environmentCount: project.environmentCount,
      share: project.environmentTime / project.trackedTime,
      suggestIsolate: !project.isolateProvided,
    }))
}
