import type { GlobOptions } from 'tinyglobby'
import type {
  ResolvedConfig as ResolvedViteConfig,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { Vitest } from '../core'
import type {
  BrowserInstanceOption,
  ResolvedConfig,
  ResolvedProjectEntry,
  TestProjectConfiguration,
  TestProjectInlineConfiguration,
  UserConfig,
  UserWorkspaceConfig,
} from '../types/config'
import { existsSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import { deepClone } from '@vitest/utils/helpers'
import { basename, dirname, relative, resolve } from 'pathe'
import { glob, isDynamicPattern } from 'tinyglobby'
import { mergeConfig, resolveConfig as viteResolveConfig } from 'vite'
import { configFiles as defaultConfigFiles } from '../../constants'
import { limitConcurrency } from '../../utils/limit-concurrency'
import { isExcludedByProjectFilter, matchesProjectFilter, resolveTestConfig } from '../config/resolveConfig'
import { WorkspaceVitestPlugin } from '../plugins/workspace'
import { TestProject } from '../project'
import { createViteServer } from '../vite'

// vitest.config.*
// vite.config.*
// vitest.unit.config.*
// vite.unit.config.*
// vitest.unit-test.config.*
const CONFIG_REGEXP = /^vite(?:st)?(?:\.[\w-]+)?\.config\./

// CLI options that can override per-project test config.
// Not all options are allowed to be overridden.
const PROJECT_CLI_OVERRIDES = [
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
  'testNamePattern',
  'passWithNoTests',
  'bail',
  'isolate',
  'printConsoleTrace',
  'inspect',
  'inspectBrk',
  'fileParallelism',
  'tagsFilter',
] as const

/**
 * Resolve the full list of project entries for the current Vitest run.
 *
 * - If the user declared `test.projects`, each declared project gets its own
 *   resolved Vite config plus per-project Vitest test config.
 * - Otherwise the root config is used as the single base entry.
 * - Browser instances expand each entry with `browser.enabled` into one entry
 *   per instance (sharing `viteConfig` with the parent).
 * - Benchmarks add a benchmark variant for each entry whose
 *   `benchmark.enabled` is true (sharing `viteConfig` with its non-benchmark
 *   counterpart).
 * - The `--project` filter is applied at the end so error messages can list
 *   every name that was considered (including instance- and benchmark-derived).
 */
export async function resolveProjectEntries(
  harness: PluginHarness,
  globalViteConfig: ResolvedViteConfig,
  globalConfig: ResolvedConfig,
  definitions: TestProjectConfiguration[] | undefined,
  workspaceConfigPath?: string,
  options?: { throwIfEmpty?: boolean; existingNames?: Set<string> },
): Promise<ResolvedProjectEntry[]> {
  const throwIfEmpty = options?.throwIfEmpty ?? true
  const existingNames = options?.existingNames
  // `definitions: []` is treated as "user declared workspace but it's empty"
  // (the old behavior throws). `definitions === undefined` means "no
  // workspace declared" and falls through to the default root-project entry.
  let baseEntries: ResolvedProjectEntry[]
  if (definitions !== undefined) {
    baseEntries = await resolveDeclaredProjectEntries(
      harness,
      globalViteConfig,
      globalConfig,
      definitions,
      workspaceConfigPath,
    )
  }
  else {
    baseEntries = [{ viteConfig: globalViteConfig, projectConfig: globalConfig }]
  }

  // Ensure project names are unique across declared projects (and any
  // already-existing projects passed via `existingNames`, which the inject
  // path uses to forbid clashes with the active workspace). Include config
  // file paths in the error when available (matches the old workspace-mode
  // duplicate-name diagnostic).
  const seenNames = new Map<string, ResolvedProjectEntry>()
  for (const entry of baseEntries) {
    const name = entry.projectConfig.name
    if (existingNames?.has(name)) {
      throw new Error(
        `Project name "${name}" is not unique. All projects should have unique names. Make sure your configuration is correct.`,
      )
    }
    const existing = seenNames.get(name)
    if (existing) {
      const entryFile = entry.viteConfig.configFile
        ? relative(globalConfig.root, entry.viteConfig.configFile)
        : ''
      const existingFile = existing.viteConfig.configFile
        ? relative(globalConfig.root, existing.viteConfig.configFile)
        : ''
      const filesError = baseEntries.length > 1 && (entryFile || existingFile)
        ? [
            '\n\nYour config matched these files:\n',
            baseEntries
              .filter(e => e.viteConfig.configFile)
              .map(e => ` - ${relative(globalConfig.root, e.viteConfig.configFile as string)}`)
              .join('\n'),
            '\n\n',
          ].join('')
        : ' '
      throw new Error([
        `Project name "${name}"`,
        entryFile ? ` from "${entryFile}"` : '',
        ' is not unique.',
        existingFile ? ` The project is already defined by "${existingFile}".` : '',
        filesError,
        'All projects should have unique names. Make sure your configuration is correct.',
      ].join(''))
    }
    seenNames.set(name, entry)
  }
  const seenNamesSet = new Set(seenNames.keys())

  // Browser instance expansion (per-entry config injection).
  const afterBrowser = expandBrowserInstancesInEntries(globalConfig, baseEntries, seenNamesSet)

  // Benchmark expansion (per-entry config injection, runs over post-browser list).
  const afterBenchmark = expandBenchmarksInEntries(afterBrowser, seenNamesSet)

  // --project filter (applied after expansion so all candidate names are known).
  const filtered = applyProjectFilter(globalConfig, afterBenchmark)

  // If the user declared `projects` (or workspace files) but the filter
  // excluded every candidate, throw with the projects definition included so
  // callers see what was tried. Skipped for the runtime `injectTestProjects`
  // path where filtering injected projects out is expected.
  const filterMatched = filtered.some(entry => !entry.hidden)
  if (throwIfEmpty && definitions && !filterMatched) {
    throw new Error(
      [
        'No projects were found. Make sure your configuration is correct. ',
        globalConfig.project.length ? `The filter matched no projects: ${globalConfig.project.join(', ')}. ` : '',
        `The projects definition: ${JSON.stringify(
          definitions.map((p, index) => typeof p === 'string'
            ? p
            : p instanceof Promise
              ? 'Promise'
              : typeof p === 'function'
                ? p.name
                : ({ name: p.test?.name ?? index })),
          null,
          4,
        )}.`,
      ].join(''),
    )
  }

  return filtered
}

async function resolveDeclaredProjectEntries(
  harness: PluginHarness,
  globalViteConfig: ResolvedViteConfig,
  globalConfig: ResolvedConfig,
  definitions: TestProjectConfiguration[],
  workspaceConfigPath: string | undefined,
): Promise<ResolvedProjectEntry[]> {
  const { configFiles, projectConfigs, nonConfigDirectories } = await resolveTestProjectConfigs(
    globalViteConfig,
    globalConfig,
    workspaceConfigPath,
    definitions,
  )

  const cliOverrides = PROJECT_CLI_OVERRIDES.reduce((acc, name) => {
    if (name in globalConfig.cliOptions) {
      acc[name] = globalConfig.cliOptions[name] as any
    }
    return acc
  }, {} as UserConfig)
  const concurrent = limitConcurrency(os.availableParallelism?.() || os.cpus().length || 5)
  const fileProjects = [...configFiles, ...nonConfigDirectories]

  const promises: Promise<ResolvedProjectEntry>[] = []

  projectConfigs.forEach((options, index) => {
    const configRoot = workspaceConfigPath ? dirname(workspaceConfigPath) : globalConfig.root
    // if extends a config file, resolve the file path
    const configFile = typeof options.extends === 'string'
      ? resolve(configRoot, options.extends)
      : options.extends === true
        ? (globalViteConfig.configFile || false)
        : false
    // if `root` is configured, resolve it relative to the workspace file or vite root (like other options)
    // if `root` is not specified, inline configs use the same root as the root project
    const root = options.root
      ? resolve(configRoot, options.root)
      : globalConfig.root

    promises.push(concurrent(() => resolveSingleProjectEntry(harness, globalViteConfig, globalConfig, {
      ...options,
      root,
      configFile,
      plugins: [
        {
          name: 'vitest:tags',
          // don't inherit tags from workspace config, they are merged separately
          configResolved(config) {
            ;(config as any).test ??= {}
            config.test!.tags = options.test!.tags! // TODO
          },
          api: {
            vitest: {
              experimental: { ignoreFsModuleCache: true },
            },
          },
        },
        ...options.plugins || [],
      ],
      test: { ...options.test, ...cliOverrides },
    }, index, cliOverrides)))
  })

  for (const path of fileProjects) {
    // if file leads to the root config, then we can just reuse it because we already initialized it
    if (globalViteConfig.configFile === path) {
      // The root viteConfig is already resolved; emit it as an entry directly.
      // Note: this matches today's "reuse default project" behavior.
      promises.push(Promise.resolve({
        viteConfig: globalViteConfig,
        projectConfig: globalConfig,
      }))
      continue
    }

    const configFile = path.endsWith('/') ? false : path
    const projectRoot = path.endsWith('/') ? path : dirname(path)

    promises.push(concurrent(() => resolveSingleProjectEntry(
      harness,
      globalViteConfig,
      globalConfig,
      { root: projectRoot, configFile, test: cliOverrides },
      path,
      cliOverrides,
    )))
  }

  if (!promises.length) {
    throw new Error(
      [
        'No projects were found. Make sure your configuration is correct. ',
        globalConfig.project.length ? `The filter matched no projects: ${globalConfig.project.join(', ')}. ` : '',
        `The projects definition: ${JSON.stringify(definitions, null, 4)}.`,
      ].join(''),
    )
  }

  const settled = await Promise.allSettled(promises)
  const errors: Error[] = []
  const entries: ResolvedProjectEntry[] = []
  for (const result of settled) {
    if (result.status === 'rejected') {
      errors.push(result.reason)
    }
    else {
      entries.push(result.value)
    }
  }

  if (errors.length) {
    throw new AggregateError(
      errors,
      'Failed to initialize projects. There were errors during projects setup. See below for more details.',
    )
  }

  return entries
}

interface ProjectInlineOptions extends TestProjectInlineConfiguration {
  root?: string
  configFile: string | false
}

/**
 * Resolve a single declared project into a `{ viteConfig, projectConfig }` entry.
 *
 * Runs `vite.resolveConfig` for the project (which fires the project's plugins'
 * `config` / `configResolved` hooks), then resolves Vitest's test config from
 * the merged options stashed on `viteConfig._vitest`. Inherits root-only
 * settings (coverage, attachmentsDir, api token, mergeReportsLabel) from the
 * root config.
 *
 * No Vite server is created; no `TestProject` is instantiated.
 */
async function resolveSingleProjectEntry(
  harness: PluginHarness,
  globalViteConfig: ResolvedViteConfig,
  globalConfig: ResolvedConfig,
  options: ProjectInlineOptions,
  workspacePath: string | number,
  _cliOverrides: UserConfig,
): Promise<ResolvedProjectEntry> {
  const { configFile, ...restOptions } = options

  const projectInline: ViteInlineConfig = {
    ...restOptions,
    configFile,
    configLoader: globalViteConfig.inlineConfig.configLoader,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.test?.mode || options.mode || globalConfig.mode,
    plugins: [
      ...(options.plugins || []),
      ...WorkspaceVitestPlugin(harness, globalViteConfig, globalConfig, { ...options, workspacePath }),
    ],
  }

  const projectViteConfig = await viteResolveConfig(projectInline, 'serve')

  // The project plugin does not stash merged options on `_vitest` (the root
  // plugin does that for the root config). For projects, read the merged test
  // config directly off the resolved Vite config — `viteConfig.test` carries
  // the user's `test` block + any additions returned from the workspace
  // plugin's `config` hook (notably the resolved project name and color).
  const mergedOptions = (projectViteConfig.test ?? {}) as UserConfig

  const projectConfig = resolveTestConfig(
    harness.logger,
    {
      ...mergedOptions,
      // root-only configs that projects inherit
      coverage: globalConfig.coverage,
      attachmentsDir: globalConfig.attachmentsDir,
    },
    projectViteConfig,
  )
  projectConfig.api.token = globalConfig.api.token
  projectConfig.mergeReportsLabel = globalConfig.mergeReportsLabel

  // Mirror the resolved test config back onto the Vite resolved config so that
  // `viteConfig.test` always reflects the most recently resolved variant of
  // that vite cluster (the "primary" view).
  projectViteConfig.test = projectConfig

  return {
    viteConfig: projectViteConfig,
    projectConfig,
  }
}

/**
 * For each entry with `browser.enabled` and `browser.instances?.length`,
 * insert one entry per instance. Each replacement shares the same
 * `viteConfig` reference as the original; only the `projectConfig` differs.
 *
 * The original (parent) entry is kept in the result with `hidden: true` so a
 * `TestProject` is still created for it — instances need a parent that owns
 * the Vite server and the browser provider (initialized lazily on
 * `parent._initParentBrowser`). The hidden parent is not pushed to
 * `vitest.projects`.
 */
function expandBrowserInstancesInEntries(
  // vitest: Vitest,
  globalConfig: ResolvedConfig,
  entries: ResolvedProjectEntry[],
  names: Set<string>,
): ResolvedProjectEntry[] {
  // Non-browser entries first, then browser-instance entries at the end.
  // Matches the old workspace behavior where the original browser project was
  // removed from the list and instance clones were appended.
  const result: ResolvedProjectEntry[] = []
  const browserEntries: ResolvedProjectEntry[] = []

  for (const entry of entries) {
    if (entry.projectConfig.browser.enabled) {
      browserEntries.push(entry)
    }
    else {
      result.push(entry)
    }
  }

  for (const entry of browserEntries) {
    const { projectConfig, viteConfig } = entry
    const instances = projectConfig.browser.instances || []
    const parentName = projectConfig.name
    // If the parent name itself is excluded by a negation filter (e.g.
    // `--project '!myproject'`), the whole cluster — parent + all instances —
    // is dropped. Otherwise, if the parent matches a positive filter, every
    // instance is kept; if not, instances are filtered individually by their
    // names. This matches the old workspace browser filter behavior.
    if (instances.length === 0 || isExcludedByProjectFilter(globalConfig.project, parentName)) {
      continue
    }
    const keepAllInstances = matchesProjectFilter(globalConfig.project, parentName)
    const filteredInstances = keepAllInstances
      ? instances
      : instances.filter(instance => matchesProjectFilter(globalConfig.project, instance.name!))
    if (!filteredInstances.length) {
      continue
    }

    // Keep the parent in the entry list as `hidden` so a `TestProject` is
    // created (instances link to it via `_parent` for the browser provider).
    // The parent's name is removed from `names` because the instance names
    // take its place in the user-facing project list.
    names.delete(parentName)
    result.push({ ...entry, hidden: true })

    filteredInstances.forEach((instance, index) => {
      const browser = instance.browser
      if (!browser) {
        const nth = index + 1
        const ending = nth === 2 ? 'nd' : nth === 3 ? 'rd' : 'th'
        throw new Error(`The browser configuration must have a "browser" property. The ${nth}${ending} item in "browser.instances" doesn't have it. Make sure your${projectConfig.name ? ` "${projectConfig.name}"` : ''} configuration is correct.`)
      }
      const name = instance.name
      if (name == null) {
        throw new Error(`The browser configuration must have a "name" property. This is a bug in Vitest. Please, open a new issue with reproduction`)
      }
      if (instance.provider?.name != null && projectConfig.browser.provider?.name != null && instance.provider?.name !== projectConfig.browser.provider?.name) {
        throw new Error(`The instance cannot have a different provider from its parent. The "${name}" instance specifies "${instance.provider?.name}" provider, but its parent has a "${projectConfig.browser.provider?.name}" provider.`)
      }

      if (names.has(name)) {
        throw new Error(
          [
            `Cannot define a nested project for a ${browser} browser. The project name "${name}" was already defined. `,
            'If you have multiple instances for the same browser, make sure to define a custom "name". ',
            'All projects should have unique names. Make sure your configuration is correct.',
          ].join(''),
        )
      }
      names.add(name)

      const clonedConfig = cloneProjectConfigForBrowserInstance(projectConfig, instance)
      clonedConfig.name = name

      result.push({
        viteConfig, // shared with parent
        projectConfig: clonedConfig,
      })
    })
  }

  return result
}

/**
 * For each entry whose `benchmark.enabled` is true, inject an additional
 * benchmark variant entry. The new entry shares `viteConfig` with its
 * non-benchmark counterpart and carries its own benchmark-shaped
 * `projectConfig`.
 *
 * Iterates the post-browser list, so benchmark variants also spawn from
 * browser-instance entries.
 */
function expandBenchmarksInEntries(
  entries: ResolvedProjectEntry[],
  names: Set<string>,
): ResolvedProjectEntry[] {
  let lastGroupOrder = Math.max(0, ...entries.map(e => e.projectConfig.sequence.groupOrder))
  const result = [...entries]

  for (const entry of entries) {
    const benchmark = entry.projectConfig.benchmark
    if (!benchmark.enabled) {
      continue
    }

    const name = entry.projectConfig.name ? `${entry.projectConfig.name} (bench)` : 'bench'

    if (names.has(name)) {
      throw new Error(`Cannot create a benchmark project because the name "${name}" is already in use.`)
    }
    names.add(name)

    const benchmarkConfig: ResolvedConfig = {
      ...entry.projectConfig,
      name,
      include: benchmark.include,
      exclude: benchmark.exclude,
      includeSource: benchmark.includeSource,
      coverage: {
        ...entry.projectConfig.coverage,
        enabled: false,
      },
      maxWorkers: 1,
      maxConcurrency: 1,
      testTimeout: entry.projectConfig.testTimeout < 60_000 ? 60_000 : entry.projectConfig.testTimeout,
      hookTimeout: entry.projectConfig.hookTimeout < 120_000 ? 120_000 : entry.projectConfig.hookTimeout,
      // Spread because we disable it in the original entry. `projectName`
      // carries the parent's name so the runtime can substitute it into
      // `${projectName}` placeholders inside `writeResult` / `bench.from()`
      // paths.
      benchmark: { ...benchmark, projectName: entry.projectConfig.name ?? '' },
      sequence: {
        ...entry.projectConfig.sequence,
        concurrent: false,
        // benchmarks should always run in a separate isolated group
        groupOrder: ++lastGroupOrder,
      },
      typecheck: {
        ...entry.projectConfig.typecheck,
        enabled: false,
      },
    }
    // disable benchmark in the original entry
    benchmark.enabled = false

    result.push({
      viteConfig: entry.viteConfig, // shared with non-benchmark counterpart
      projectConfig: benchmarkConfig,
    })
  }

  return result
}

/**
 * Drop entries that don't match the `--project` CLI filter. Hidden entries
 * (browser-instance parents) are always kept so siblings can attach to them.
 * Browser-instance entries (those sharing `viteConfig` with a hidden parent)
 * are also kept here — they were already vetted by the browser expansion
 * step against the parent's name, and their derived names like
 * "myproject (chromium)" wouldn't satisfy a literal `myproject` filter.
 */
function applyProjectFilter(
  globalConfig: ResolvedConfig,
  entries: ResolvedProjectEntry[],
): ResolvedProjectEntry[] {
  const filter = globalConfig.project
  if (!filter.length) {
    return entries
  }
  const browserClusterViteConfigs = new Set(
    entries.filter(e => e.hidden).map(e => e.viteConfig),
  )
  return entries.filter((entry) => {
    if (entry.hidden) {
      return true
    }
    if (browserClusterViteConfigs.has(entry.viteConfig)) {
      // Browser instance: already filtered during expansion.
      return true
    }
    return matchesProjectFilter(filter, entry.projectConfig.name)
  })
}

function cloneProjectConfigForBrowserInstance(
  parentConfig: ResolvedConfig,
  { browser, ...config }: BrowserInstanceOption,
): ResolvedConfig {
  const {
    locators,
    viewport,
    testerHtmlPath,
    headless,
    screenshotDirectory,
    screenshotFailures,
    fileParallelism,
    // @ts-expect-error remove just in case
    browser: _browser,
    name,
    provider,
    ...overrideConfig
  } = config
  const currentBrowser = parentConfig.browser
  const clonedConfig = deepClone(parentConfig)
  return mergeConfig<any, any>({
    ...clonedConfig,
    browser: {
      ...parentConfig.browser,
      locators: locators
        ? {
            testIdAttribute: locators.testIdAttribute ?? currentBrowser.locators.testIdAttribute,
            exact: locators.exact ?? currentBrowser.locators.exact,
            errorFormat: locators.errorFormat ?? currentBrowser.locators.errorFormat,
          }
        : parentConfig.browser.locators,
      viewport: viewport ?? currentBrowser.viewport,
      testerHtmlPath: testerHtmlPath ?? currentBrowser.testerHtmlPath,
      screenshotDirectory: screenshotDirectory ?? currentBrowser.screenshotDirectory,
      screenshotFailures: screenshotFailures ?? currentBrowser.screenshotFailures,
      headless: headless ?? currentBrowser.headless,
      provider: provider ?? currentBrowser.provider,
      fileParallelism: fileParallelism ?? currentBrowser.fileParallelism,
      name: browser,
      instances: [], // projects cannot spawn more configs
    },
    // If there is no include or exclude or includeSource pattern in browser.instances[], we should use the that's pattern from the parent project
    include: (overrideConfig.include && overrideConfig.include.length > 0) ? [] : clonedConfig.include,
    exclude: (overrideConfig.exclude && overrideConfig.exclude.length > 0) ? [] : clonedConfig.exclude,
    includeSource: (overrideConfig.includeSource && overrideConfig.includeSource.length > 0) ? [] : clonedConfig.includeSource,
  } satisfies ResolvedConfig, overrideConfig) as ResolvedConfig
}

async function resolveTestProjectConfigs(
  globalViteConfig: ResolvedViteConfig,
  globalConfig: ResolvedConfig,
  workspaceConfigPath: string | undefined,
  projectsDefinition: TestProjectConfiguration[],
) {
  // project configurations that were specified directly
  const projectsOptions: (UserWorkspaceConfig & { extends?: true | string })[] = []

  // custom config files that were specified directly or resolved from a directory
  const projectsConfigFiles: string[] = []

  // custom glob matches that should be resolved as directories or config files
  const projectsGlobMatches: string[] = []

  // directories that don't have a config file inside, but should be treated as projects
  const nonConfigProjectDirectories: string[] = []

  for (const definition of projectsDefinition) {
    if (typeof definition === 'string') {
      const stringOption = definition.replace('<rootDir>', globalConfig.root)
      // if the string doesn't contain a glob, we can resolve it directly
      // ['./vitest.config.js']
      if (!isDynamicPattern(stringOption)) {
        const file = resolve(globalConfig.root, stringOption)

        if (!existsSync(file)) {
          const relativeWorkspaceConfigPath = workspaceConfigPath
            ? relative(globalConfig.root, workspaceConfigPath)
            : undefined
          const note = workspaceConfigPath ? `Workspace config file "${relativeWorkspaceConfigPath}"` : 'Projects definition'
          throw new Error(`${note} references a non-existing file or a directory: ${file}`)
        }

        const stats = statSync(file)
        // user can specify a config file directly
        if (stats.isFile()) {
          const name = basename(file)
          if (!CONFIG_REGEXP.test(name)) {
            throw new Error(
              `The file "${relative(globalConfig.root, file)}" must start with "vitest.config"/"vite.config" `
              + `or match the pattern "(vitest|vite).*.config.*" to be a valid project config.`,
            )
          }

          projectsConfigFiles.push(file)
        }
        // user can specify a directory that should be used as a project
        else if (stats.isDirectory()) {
          const configFile = resolveDirectoryConfig(file)
          if (configFile) {
            projectsConfigFiles.push(configFile)
          }
          else {
            const directory = file.at(-1) === '/' ? file : `${file}/`
            nonConfigProjectDirectories.push(directory)
          }
        }
        else {
          // should never happen
          throw new TypeError(`Unexpected file type: ${file}`)
        }
      }
      // if the string is a glob pattern, resolve it later
      // ['./packages/*']
      else {
        projectsGlobMatches.push(stringOption)
      }
    }
    // if the config is inlined, we can resolve it immediately
    else if (typeof definition === 'function') {
      projectsOptions.push(await definition({
        command: 'serve',
        mode: globalViteConfig.mode,
        isPreview: false,
        isSsrBuild: false,
      }))
    }
    // the config is an object or a Promise that returns an object
    else {
      projectsOptions.push(await definition)
    }
  }

  if (projectsGlobMatches.length) {
    const globOptions: GlobOptions = {
      absolute: true,
      dot: true,
      onlyFiles: false,
      cwd: globalConfig.root,
      expandDirectories: false,
      ignore: [
        '**/node_modules/**',
        // temporary vite config file
        '**/*.timestamp-*',
        // macOS directory metadata
        '**/.DS_Store',
      ],
    }

    const projectsFs = await glob(projectsGlobMatches, globOptions)

    projectsFs.forEach((path) => {
      // directories are allowed with a glob like `packages/*`
      // in this case every directory is treated as a project
      if (path.endsWith('/')) {
        const configFile = resolveDirectoryConfig(path)
        if (configFile) {
          projectsConfigFiles.push(configFile)
        }
        else {
          nonConfigProjectDirectories.push(path)
        }
      }
      else {
        const name = basename(path)
        if (!CONFIG_REGEXP.test(name)) {
          throw new Error(
            `The projects glob matched a file "${relative(globalConfig.root, path)}", `
            + `but it should also either start with "vitest.config"/"vite.config" `
            + `or match the pattern "(vitest|vite).*.config.*".`,
          )
        }
        projectsConfigFiles.push(path)
      }
    })
  }

  const projectConfigFiles = Array.from(new Set(projectsConfigFiles))

  return {
    projectConfigs: projectsOptions,
    nonConfigDirectories: nonConfigProjectDirectories,
    configFiles: projectConfigFiles,
  }
}

function resolveDirectoryConfig(directory: string) {
  const files = new Set(readdirSync(directory))
  // default resolution looks for vitest.config.* or vite.config.* files
  // this simulates how `findUp` works in packages/vitest/src/node/create.ts:29
  const configFile = defaultConfigFiles.find(file => files.has(file))
  if (configFile) {
    return resolve(directory, configFile)
  }
  return null
}

/**
 * Create `TestProject` instances from resolved project entries and attach Vite
 * servers, deduping by `viteConfig` identity so projects that share a vite
 * config also share a server.
 *
 * Primary projects (first encounter of a given `viteConfig`) create the Vite
 * server and own the resolver / fetcher / runner. Sibling projects (later
 * entries with the same `viteConfig`) share those resources.
 */
export async function attachProjectsFromEntries(
  vitest: Vitest,
  entries: ResolvedProjectEntry[],
): Promise<TestProject[]> {
  // For each unique `viteConfig`, the "primary" project owns the server and
  // its server-derived resources (runner, resolver, fetcher, browser
  // provider). Siblings (browser instance variants, benchmark variants) share
  // these resources by linking to the primary via `_parent`.
  const primaryByViteConfig = new Map<ResolvedViteConfig, TestProject>()

  // The root Vite config can also serve as a project's `viteConfig` — either
  // the default no-`projects` case or browser/benchmark variants of it.
  // `coreWorkspaceProject` is the stable "parent" for that cluster, owning
  // any browser provider that gets initialized. Set it up unconditionally
  // here so siblings can attach to it.
  if (!vitest.coreWorkspaceProject && vitest.vite && vitest.viteConfig) {
    vitest.coreWorkspaceProject = TestProject._createBasicProject(vitest)
    primaryByViteConfig.set(vitest.viteConfig, vitest.coreWorkspaceProject)
  }

  const projects: TestProject[] = []

  for (const entry of entries) {
    const { viteConfig, projectConfig, hidden } = entry
    const primary = primaryByViteConfig.get(viteConfig)
    if (primary) {
      // Default-project no-browser case: the entry's `projectConfig` IS the
      // root's resolved config. Use `coreWorkspaceProject` directly so
      // callers that rely on `project === vitest.getRootProject()` work
      // (and so we don't have two TestProjects representing the same root).
      if (primary === vitest.coreWorkspaceProject && projectConfig === vitest.config) {
        if (!hidden) {
          projects.push(vitest.coreWorkspaceProject)
        }
        continue
      }
      const sibling = TestProject._spawnSibling(primary, projectConfig)
      if (!hidden) {
        projects.push(sibling)
      }
      continue
    }

    const server = await createViteServer(viteConfig)

    // Workspace project with its own `viteConfig`: own a fresh Vite server.
    const project = new TestProject(vitest, server, viteConfig, projectConfig)
    project._initializeRunners(server)
    primaryByViteConfig.set(viteConfig, project)
    if (!hidden) {
      projects.push(project)
    }
  }

  return projects
}

/**
 * Public entry point used by `injectTestProject` to add projects at runtime.
 * Resolves entries from the given definitions and attaches `TestProject`s with
 * their Vite servers.
 */
export async function resolveAndAttachProjects(
  harness: PluginHarness,
  definitions: TestProjectConfiguration[],
  workspaceConfigPath?: string,
): Promise<TestProject[]> {
  // Use the same per-entry resolution as the main pipeline (no expansion of
  // browser instances or benchmarks here — injected projects already pass
  // through the regular expansion via `resolveProjectEntries`).
  //
  // `throwIfEmpty: false` because filtering an injected project out is
  // expected at runtime (the user can call `injectTestProjects` with a name
  // that doesn't match the active filter; we just return an empty list).
  //
  // `existingNames` enforces uniqueness against the already-active workspace.
  const vitest = harness.getVitest()
  const entries = await resolveProjectEntries(
    harness,
    vitest.viteConfig,
    vitest.config,
    definitions,
    workspaceConfigPath,
    {
      throwIfEmpty: false,
      existingNames: new Set(vitest.projects.map(p => p.name)),
    },
  )
  return attachProjectsFromEntries(vitest, entries)
}
