import type { GlobOptions } from 'tinyglobby'
import type {
  ResolvedConfig as ResolvedViteConfig,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { Vitest } from '../core'
import type {
  BrowserInstanceOption,
  ConfigResolutionCaptures,
  ProjectName,
  ResolvedConfig,
  ResolvedProjectEntry,
  TestProjectConfiguration,
  TestProjectInlineConfiguration,
  UserConfig,
  UserWorkspaceConfig,
} from '../types/config'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import os from 'node:os'
import { deepClone } from '@vitest/utils/helpers'
import { basename, dirname, relative, resolve } from 'pathe'
import { glob, isDynamicPattern } from 'tinyglobby'
import { mergeConfig, resolveConfig as viteResolveConfig } from 'vite'
import { configFiles as defaultConfigFiles } from '../../constants'
import { wildcardPatternToRegExp } from '../../utils/base'
import { limitConcurrency } from '../../utils/limit-concurrency'
import { CaptureRawTestConfig, isExcludedByProjectFilter, matchesProjectFilter, resolveTestConfig } from '../config/resolveConfig'
import { BrowserLoaderPlugin, createClusterServer } from '../plugins/browserLoader'
import { resolveTestOptions, TestConfigPlugin } from '../plugins/testConfig'
import { WorkspaceVitestPlugin } from '../plugins/workspace'
import { TestProject } from '../project'
import { globProjectTestFiles } from './globProjectFiles'

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
] as const

/**
 * Resolve the full list of project entries for the current Vitest run.
 *
 * - If the user declared `test.projects`, each declared project gets its own
 *   resolved Vite config plus per-project Vitest test config.
 * - Otherwise the root config is used as the single base entry.
 * - A file-based project whose config declares `projects` itself is a
 *   container: like the root, it doesn't run tests and is replaced by the
 *   projects it declares (recursively).
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
  options: { throwIfEmpty?: boolean; existingNames?: Set<string> } = {},
): Promise<ResolvedProjectEntry[]> {
  const throwIfEmpty = options.throwIfEmpty ?? true
  const existingNames = options.existingNames
  // `definitions: []` is treated as "user declared workspace but it's empty"
  // `definitions === undefined` means "no workspace declared" and
  // falls through to the default root-project entry.
  let baseEntries: ResolvedProjectEntry[]
  if (definitions !== undefined) {
    const cliOverrides = PROJECT_CLI_OVERRIDES.reduce((acc, name) => {
      if (name in globalConfig.cliOptions) {
        acc[name] = globalConfig.cliOptions[name] as any
      }
      return acc
    }, {} as UserConfig)
    const containerConfigFiles: string[] = []
    const context: ProjectsResolutionContext = {
      harness,
      rootViteConfig: globalViteConfig,
      rootConfig: globalConfig,
      parentViteConfig: globalViteConfig,
      parentConfig: globalConfig,
      cliOverrides,
      ancestors: [],
      chain: globalViteConfig.configFile
        ? [safeRealpath(globalViteConfig.configFile)]
        : [],
      containerConfigFiles,
    }
    baseEntries = await resolveDeclaredProjectEntries(context, definitions)
    if (containerConfigFiles.length) {
      // appended rather than assigned so `injectTestProjects` containers
      // are also watched
      globalConfig._containerConfigFiles = [
        ...(globalConfig._containerConfigFiles || []),
        ...containerConfigFiles,
      ]
    }
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
      // inline entries carry the configFile they extend, which doesn't say
      // where the project is declared, so they are reported without a file
      const entryFile = !entry.inline && entry.viteConfig.configFile
        ? relative(globalConfig.root, entry.viteConfig.configFile)
        : ''
      const existingFile = !existing.inline && existing.viteConfig.configFile
        ? relative(globalConfig.root, existing.viteConfig.configFile)
        : ''
      const filesError = baseEntries.length > 1 && (entryFile || existingFile)
        ? [
            '\n\nYour config matched these files:\n',
            baseEntries
              .filter(e => !e.inline && e.viteConfig.configFile)
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
  // `--benchmark` makes every project run as a benchmark.
  const afterBenchmark = expandBenchmarksInEntries(afterBrowser, seenNamesSet, !!globalConfig.cliOptions.benchmarkOnly)

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

  // Browser servers must pre-bundle dependencies before they are created, and a
  // single server can be shared by several projects (browser instances and
  // benchmark variants). Aggregate each shared server's `optimizeDeps` now that
  // every project's config is fully resolved.
  await applyBrowserOptimizeDeps(harness, filtered)

  return filtered
}

/**
 * Aggregate `optimizeDeps` for each browser Vite server across every project
 * that shares it, then merge the result into the resolved Vite config's `client`
 * environment. Runs after resolution (so project `include`/`setupFiles` are
 * known) and before server creation (so `createViteServer` reuses the mutated
 * resolved config).
 */
async function applyBrowserOptimizeDeps(
  harness: PluginHarness,
  entries: ResolvedProjectEntry[],
): Promise<void> {
  const groups = new Map<ResolvedViteConfig, ResolvedProjectEntry[]>()
  for (const entry of entries) {
    const { viteConfig } = entry
    let group = groups.get(viteConfig)
    if (!group) {
      group = []
      groups.set(viteConfig, group)
    }
    group.push(entry)
  }

  // Most projects in a group share identical glob inputs (the `dir`/`root` is
  // always the same and cannot be overridden by an instance option), so cache
  // the result per unique input set to avoid re-globbing the same files.
  const fileListCache = new Map<string, Promise<string[]>>()
  const globTestFiles = (config: ResolvedConfig) => {
    const cwd = config.dir || config.root
    const key = JSON.stringify([config.include, config.exclude, config.includeSource, cwd])
    let fileList = fileListCache.get(key)
    if (!fileList) {
      fileList = globProjectTestFiles(config.include, config.exclude, config.includeSource, cwd)
      fileListCache.set(key, fileList)
    }
    return fileList
  }

  await Promise.all(
    Array.from(groups, async ([viteConfig, projectEntries]) => {
      const projectConfigs = projectEntries.map(entry => entry.projectConfig)
      const contribution = projectConfigs.find(config => config._browserContribution)?._browserContribution
      if (!contribution) {
        return
      }
      const fileLists = await Promise.all(projectConfigs.map(globTestFiles))
      projectEntries.forEach((entry, index) => {
        entry.hasTestFiles = fileLists[index].length > 0
      })
      const testFiles = [...new Set(fileLists.flat())]
      const optimizeDeps = await contribution.resolveOptimizeDeps(projectConfigs, testFiles, harness)
      // the browser runs in the `client` environment, but Vite's dep scanner
      // reads the top-level `optimizeDeps`, so keep both in sync (`mergeConfig`
      // concatenates arrays, preserving user/default values)
      const merged = mergeConfig(
        { optimizeDeps: viteConfig.optimizeDeps },
        { optimizeDeps },
      ).optimizeDeps
      ;(viteConfig as any).optimizeDeps = { ...merged }
      viteConfig.environments.client.optimizeDeps = { ...viteConfig.optimizeDeps }
    }),
  )
}

/**
 * The set of values threaded through (possibly recursive) project resolution.
 *
 * The `root*` pair is the true root config: it carries run-wide values (CLI
 * options, the `--project` filter, the programmatic config). The `parent*`
 * pair is the config the current `projects` array is declared in — the root
 * itself or a container config — and provides the default `extends` target,
 * env defaults and the base for resolving relative definitions.
 */
interface ProjectsResolutionContext {
  harness: PluginHarness
  rootViteConfig: ResolvedViteConfig
  rootConfig: ResolvedConfig
  parentViteConfig: ResolvedViteConfig
  parentConfig: ResolvedConfig
  /** CLI options projects may override, computed once from the root's `cliOptions` */
  cliOverrides: UserConfig
  /** names of the containers above this level, outermost first */
  ancestors: string[]
  /** realpaths of the config files above this level, the cycle guard */
  chain: string[]
  /** shared across levels; collects container config files for the watcher */
  containerConfigFiles: string[]
}

async function resolveDeclaredProjectEntries(
  context: ProjectsResolutionContext,
  definitions: TestProjectConfiguration[],
): Promise<ResolvedProjectEntry[]> {
  const { parentViteConfig, parentConfig } = context
  const { configFiles, projectConfigs, nonConfigDirectories } = await resolveTestProjectConfigs(
    parentViteConfig,
    parentConfig,
    definitions,
  )

  const concurrent = limitConcurrency(os.availableParallelism?.() || os.cpus().length || 5)
  const fileProjects = [...configFiles, ...nonConfigDirectories]

  const promises: Promise<ResolvedProjectEntry>[] = []

  projectConfigs.forEach((options, index) => {
    if (canShareParentServer(context, options)) {
      // no `concurrent()`: there is no Vite resolution to limit
      promises.push(Promise.resolve().then(() => resolveSharedServerEntry(context, options, index)))
      return
    }

    const configRoot = parentConfig.root
    // if extends a config file, resolve the file path
    const configFile = typeof options.extends === 'string'
      ? resolve(configRoot, options.extends)
      : options.extends !== false
        ? (parentViteConfig.configFile || false)
        : false
    // if `root` is configured, resolve it relative to the declaring config's
    // root (like other options); if `root` is not specified, inline configs
    // use the same root as the declaring config
    const rawRoot = options.test?.root ?? options.root
    const root = rawRoot
      ? resolve(configRoot, rawRoot)
      : configRoot

    promises.push(concurrent(() => resolveSingleProjectEntry(context, {
      ...options,
      root,
      configFile,
    }, index)))
  })

  for (const path of fileProjects) {
    // if the file leads to the declaring config itself, reuse the already
    // resolved pair: the root (or the container) also runs as a regular project
    if (parentViteConfig.configFile === path) {
      promises.push(Promise.resolve({
        viteConfig: parentViteConfig,
        projectConfig: parentConfig,
        ancestors: context.ancestors.length > 1
          ? context.ancestors.slice(0, -1)
          : undefined,
      }))
      continue
    }

    const configFile = path.endsWith('/') ? false : path
    const projectRoot = path.endsWith('/') ? path : dirname(path)

    promises.push(concurrent(() => resolveSingleProjectEntry(
      context,
      { root: projectRoot, configFile },
      path,
    )))
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

  return flattenContainerEntries(context, entries)
}

/**
 * Replace container entries (file-based configs that declare `projects`) with
 * the projects they declare, recursively. A container behaves like the root
 * config: it doesn't run tests and never gets a Vite server; its projects
 * extend it by default and their names are prefixed with the container's name.
 */
async function flattenContainerEntries(
  context: ProjectsResolutionContext,
  entries: ResolvedProjectEntry[],
): Promise<ResolvedProjectEntry[]> {
  const result: ResolvedProjectEntry[] = []
  for (const entry of entries) {
    const definitions = entry.projectConfig.projects
    // inline projects cannot declare `projects`; the declaring config's own
    // entry (emitted when it references its own config file) is kept as-is —
    // its `projects` are the definitions currently being resolved
    if (entry.inline || definitions === undefined || entry.projectConfig === context.parentConfig) {
      result.push(entry)
      continue
    }

    const configFile = entry.viteConfig.configFile
    const relativeFile = configFile
      ? relative(context.rootConfig.root, configFile)
      : entry.projectConfig.name
    let chain = context.chain
    if (configFile) {
      const realConfigFile = safeRealpath(configFile)
      if (chain.includes(realConfigFile)) {
        throw new Error(
          [
            `Found a circular "projects" definition: `,
            [...chain, realConfigFile].map(file => `"${relative(context.rootConfig.root, file)}"`).join(' -> '),
            '. Make sure your configuration is correct.',
          ].join(''),
        )
      }
      chain = [...chain, realConfigFile]
      context.containerConfigFiles.push(configFile)
    }

    const childContext: ProjectsResolutionContext = {
      ...context,
      parentViteConfig: entry.viteConfig,
      parentConfig: entry.projectConfig,
      ancestors: [...context.ancestors, entry.projectConfig.name],
      chain,
    }
    const children = await resolveDeclaredProjectEntries(childContext, definitions)
    // the raw config was only needed to resolve this container's projects,
    // which are all known by now; the resolved container config outlives this
    // resolution (children keep its server alive), so don't let it retain the
    // raw copy for the whole session
    entry.projectConfig._rawTestConfig = undefined
    if (!children.length) {
      throw new Error(
        `No projects were found in "${relativeFile}". Make sure your configuration is correct.`,
      )
    }
    result.push(...children)
  }
  return result
}

function safeRealpath(path: string): string {
  try {
    return realpathSync(path)
  }
  catch {
    return path
  }
}

/**
 * Merges the programmatic config passed to `createVitest` into an extending
 * project's options. The programmatic config is part of the effective root
 * config, so a project inherits it even when the root config file doesn't
 * exist. Some options never transfer to a project:
 * - `plugins` are live instances owned by the root server
 * - `tagsFilter` is CLI-only; `PROJECT_CLI_OVERRIDES` applies it per project
 * - `browser` describes the instances of a single project; inheriting it
 *   would create duplicate instance names (the `--browser` flags have the
 *   same guard in `vitest:config:cli`)
 */
function inheritRootViteOverrides(
  rootConfig: ResolvedConfig,
  options: ViteInlineConfig,
): ViteInlineConfig {
  const { plugins: _plugins, ...rootViteOverrides } = rootConfig.viteOverrides
  // cloned so plugins that mutate inherited arrays in place don't share
  // them between the root and every project
  const inherited = deepClone(rootViteOverrides)
  delete (inherited.test as UserConfig | undefined)?.tagsFilter
  delete (inherited.test as UserConfig | undefined)?.browser
  return mergeConfig(inherited, options)
}

// test options that reach the Vite config during a project's resolution:
// `alias` is hoisted into `resolve.alias`, `css` configures CSS processing
// and scoped class names, `mode` selects env files and plugin behavior,
// `root` anchors the server, and `browser` selects a browser server
const VITE_AFFECTING_TEST_OPTIONS = ['alias', 'browser', 'css', 'mode', 'root'] as const

/**
 * An inline project can share the declaring config's Vite server when a full
 * resolution would produce the same Vite config: it extends the declaring
 * config and defines nothing that affects the Vite config. Only the
 * project's own options matter — the server was already resolved with the
 * inherited ones.
 */
function canShareParentServer(
  context: ProjectsResolutionContext,
  options: UserWorkspaceConfig & { extends?: boolean | string },
): boolean {
  const rawParentTest = context.parentConfig._rawTestConfig
  if (!context.rootConfig.sharedViteServer || rawParentTest === undefined) {
    return false
  }
  if (options.extends !== undefined && options.extends !== true) {
    return false
  }
  for (const key in options) {
    if (key !== 'test' && key !== 'extends') {
      return false
    }
  }
  // an inherited `browser` config makes the project a browser project, which
  // needs its own browser server; other inherited values are safe
  if (rawParentTest.browser) {
    return false
  }
  const test = options.test
  if (!test) {
    return true
  }
  if (VITE_AFFECTING_TEST_OPTIONS.some(option => test[option as keyof typeof test] !== undefined)) {
    return false
  }
  // the dependency optimizer state (scanned deps, rewritten import URLs)
  // belongs to the server, and `deps.moduleDirectories` configures the
  // server's `resolve` options
  const deps = test.deps
  if (deps?.optimizer !== undefined || deps?.moduleDirectories !== undefined) {
    return false
  }
  return true
}

/**
 * Resolve an inline project that shares the declaring config's Vite server.
 * Instead of re-executing the config file through Vite, the project's options
 * are merged onto the declaring config's raw `test` options and run through
 * the same `TestConfigPlugin` hooks a full resolution applies.
 */
function resolveSharedServerEntry(
  context: ProjectsResolutionContext,
  options: TestProjectInlineConfiguration,
  index: number,
): ResolvedProjectEntry {
  const { harness, rootConfig, parentViteConfig, parentConfig, cliOverrides } = context

  // the base is cloned so children never share mutable values with each other
  // or with the captured config; `mergeConfig` applies the same rules Vite
  // uses when the extending project is resolved with `configFile` (inline
  // values win, arrays are concatenated)
  const merged = mergeConfig(
    { test: deepClone(parentConfig._rawTestConfig) },
    { test: options.test ?? {} },
  ).test as UserConfig

  const mergedOptions = resolveTestOptions(merged, {
    harness,
    cliOptions: cliOverrides,
    globalConfig: rootConfig,
    project: { options, extendsTrueRootConfig: parentConfig === rootConfig },
    sharedServer: {
      defines: parentConfig.defines,
      moduleRunnerOptions: parentConfig._moduleRunnerOptions,
    },
  })

  mergedOptions.name = resolveProjectName(
    mergedOptions.name,
    index,
    context.ancestors.at(-1),
  )

  const projectConfig = resolveTestConfig(
    harness.logger,
    mergedOptions,
    parentViteConfig,
    parentConfig,
  )

  return {
    viteConfig: parentViteConfig,
    projectConfig,
    inline: true,
    sharedServer: true,
    ancestors: context.ancestors.length ? [...context.ancestors] : undefined,
  }
}

async function resolveSingleProjectEntry(
  context: ProjectsResolutionContext,
  options: ViteInlineConfig & { extends?: string | boolean },
  workspacePath: string | number,
): Promise<ResolvedProjectEntry> {
  const { harness, rootViteConfig, rootConfig, parentViteConfig, parentConfig, cliOverrides } = context
  const { configFile, ...restOptions } = options

  const captures: ConfigResolutionCaptures = {}

  // only inline entries (keyed by their index) extend another config;
  // file-based projects own all of their values
  const isInlineEntry = typeof workspacePath === 'number'
  const inheritsParentConfig = isInlineEntry
    && options.extends !== false
    && typeof options.extends !== 'string'
  // the root `globalSetup` runs once per test run, so it is stripped from
  // projects extending the root config file (directly or via `extends: true`
  // at the top level); a container's `globalSetup` stays inherited because
  // nothing else runs it, like any other non-root extended config
  const extendsTrueRootConfig = (inheritsParentConfig && parentConfig === rootConfig)
    || (!!configFile && configFile === rootViteConfig.configFile)

  // the programmatic config is part of the effective root config; a container
  // is fully described by its file, so only root-level projects inherit it
  const inlineOptions = inheritsParentConfig && parentConfig === rootConfig
    ? inheritRootViteOverrides(rootConfig, restOptions)
    : restOptions

  const projectInline: ViteInlineConfig = {
    ...inlineOptions,
    configFile,
    configLoader: parentViteConfig.inlineConfig.configLoader,
    // this will make "mode": "test" inside defineConfig
    mode: options.test?.mode || options.mode || parentConfig.mode,
    plugins: [
      CaptureRawTestConfig(captures, rootConfig.sharedViteServer),
      ...TestConfigPlugin(
        harness,
        captures,
        cliOverrides,
        rootConfig,
        isInlineEntry ? { options, extendsTrueRootConfig } : undefined,
      ),
      ...(options.plugins || []),
      ...WorkspaceVitestPlugin(
        harness,
        parentViteConfig,
        rootConfig,
        options,
      ),
      ...BrowserLoaderPlugin(captures, harness),
    ],
  }

  const projectViteConfig = await viteResolveConfig(projectInline, 'serve')

  // inherit the declaring config's resolved env as defaults; a project's own
  // env wins, like every other option a project can override
  for (const key in parentViteConfig.env) {
    projectViteConfig.env[key] ??= parentViteConfig.env[key]
  }

  const mergedOptions = (projectViteConfig.test ?? {}) as UserConfig

  // resolved after `viteResolveConfig` so a plugin can still set `test.name`
  mergedOptions.name = resolveProjectName(
    mergedOptions.name,
    workspacePath,
    context.ancestors.at(-1),
  )

  const projectConfig = resolveTestConfig(
    harness.logger,
    mergedOptions,
    projectViteConfig,
    parentConfig,
  )

  projectViteConfig.test = projectConfig

  // The browser provider's contribution (captured during this resolution by the
  // `vitest:browser:loader` plugin) is carried on the resolved config + entry so
  // server creation can build the single shared Vite server.
  projectConfig._browserContribution = captures.browserContribution

  projectConfig._rawTestConfig = captures.rawTestConfig
  projectConfig._moduleRunnerOptions = captures.moduleRunnerOptions
  // `captures` lives as long as the server that keeps its plugins,
  // so it should not hold onto the config
  captures.rawTestConfig = undefined

  return {
    viteConfig: projectViteConfig,
    projectConfig,
    inline: isInlineEntry,
    ancestors: context.ancestors.length ? [...context.ancestors] : undefined,
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
  globalConfig: ResolvedConfig,
  entries: ResolvedProjectEntry[],
  names: Set<string>,
): ResolvedProjectEntry[] {
  // non-browser entries first, then each browser parent followed by its instances
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
    const parentName = projectConfig.name

    const instances = projectConfig.browser.instances ?? []
    if (instances.length === 0 || isEntryExcludedByFilter(globalConfig.project, parentName, entry.ancestors)) {
      continue
    }

    const keepAllInstances = matchesEntryFilter(globalConfig.project, parentName, entry.ancestors)
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

      const provider = instance.provider?.name ?? projectConfig.browser.provider?.name ?? 'preview'

      // Browser-mode CDP only features:
      if (provider === 'preview' || !isChromiumName(provider, browser)) {
        const browserConfig = `
{
  browser: {
    provider: ${provider}(),
    instances: [
      ${(filteredInstances || []).map(i => `{ browser: '${i.browser}' }`).join(',\n      ')}
    ],
  },
}
          `.trim()

        const preferredProvider = provider === 'preview'
          ? 'playwright'
          : provider
        const preferredBrowser = preferredProvider === 'playwright' ? 'chromium' : 'chrome'
        const correctExample = `
{
  browser: {
    provider: ${preferredProvider}(),
    instances: [
      { browser: '${preferredBrowser}' }
    ],
  },
}
          `.trim()

        if (projectConfig.coverage.enabled && projectConfig.coverage.provider === 'v8') {
          const coverageExample = `
{
  coverage: {
    provider: 'istanbul',
  },
}
            `.trim()

          throw new Error(
            `@vitest/coverage-v8 does not work with\n${browserConfig}\n`
            + `\nUse either:\n${correctExample}`
            + `\n\n...or change your coverage provider to:\n${coverageExample}\n`,
          )
        }

        if (globalConfig.inspect || globalConfig.inspectBrk) {
          const inspectOption = `--inspect${globalConfig.inspectBrk ? '-brk' : ''}`

          throw new Error(
            `${inspectOption} does not work with\n${browserConfig}\n`
            + `\nUse either:\n${correctExample}`
            + `\n\n...or disable ${inspectOption}\n`,
          )
        }
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
        ancestors: entry.ancestors,
      })
    })
  }

  return result
}

/**
 * For each benchmark-enabled entry (or every entry when `benchmarkOnly`), inject
 * an additional benchmark variant entry. The new entry shares `viteConfig` with
 * its non-benchmark counterpart and carries its own benchmark-shaped
 * `projectConfig`.
 *
 * Iterates the post-browser list, so benchmark variants also spawn from
 * browser-instance entries.
 */
function expandBenchmarksInEntries(
  entries: ResolvedProjectEntry[],
  names: Set<string>,
  benchmarkOnly: boolean,
): ResolvedProjectEntry[] {
  let lastGroupOrder = Math.max(0, ...entries.map(e => e.projectConfig.sequence.groupOrder))
  const result = [...entries]

  for (const entry of entries) {
    const benchmark = entry.projectConfig.benchmark
    if ((!benchmark.enabled && !benchmarkOnly) || entry.hidden) {
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
      // `enabled` because the original entry might not be benchmark-enabled (when
      // forced by `--benchmark`); `projectName` carries the parent's name so the
      // runtime can substitute it into `${projectName}` placeholders inside
      // `writeResult` / `bench.from()` paths.
      benchmark: { ...benchmark, enabled: true, projectName: entry.projectConfig.name ?? '' },
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
      ancestors: entry.ancestors,
      sharedServer: entry.sharedServer,
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
    return matchesEntryFilter(filter, entry.projectConfig.name, entry.ancestors)
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
    maxWorkers: config.fileParallelism === false ? 1 : clonedConfig.maxWorkers,
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
      name: browser,
      instances: [], // projects cannot spawn more configs
    },
    // If there is no include or exclude or includeSource pattern in browser.instances[], we should use the that's pattern from the parent project
    include: (overrideConfig.include && overrideConfig.include.length > 0) ? [] : clonedConfig.include,
    exclude: (overrideConfig.exclude && overrideConfig.exclude.length > 0) ? [] : clonedConfig.exclude,
    includeSource: (overrideConfig.includeSource && overrideConfig.includeSource.length > 0) ? [] : clonedConfig.includeSource,
  } satisfies ResolvedConfig, overrideConfig) as ResolvedConfig
}

/**
 * Match an entry against the `--project` filter. In addition to the entry's
 * own name, the names of the containers it is nested under are considered,
 * so a container name selects (or excludes) its whole subtree.
 */
function matchesEntryFilter(
  filter: string[],
  name: string,
  ancestors: string[] | undefined,
): boolean {
  if (!filter.length) {
    return true
  }
  const names = [name, ...(ancestors || [])]
  return filter.some((project) => {
    const regexp = wildcardPatternToRegExp(project)
    // a negated pattern compiles into a negative lookahead: the entry is kept
    // only when neither its name nor any of its containers match the exclusion
    return project.startsWith('!')
      ? names.every(candidate => regexp.test(candidate))
      : names.some(candidate => regexp.test(candidate))
  })
}

function isEntryExcludedByFilter(
  filter: string[],
  name: string,
  ancestors: string[] | undefined,
): boolean {
  return isExcludedByProjectFilter(filter, name)
    || !!ancestors?.some(ancestor => isExcludedByProjectFilter(filter, ancestor))
}

async function resolveTestProjectConfigs(
  parentViteConfig: ResolvedViteConfig,
  parentConfig: ResolvedConfig,
  projectsDefinition: TestProjectConfiguration[],
) {
  // project configurations that were specified directly
  const projectsOptions: (UserWorkspaceConfig & { extends?: boolean | string })[] = []

  // custom config files that were specified directly or resolved from a directory
  const projectsConfigFiles: string[] = []

  // custom glob matches that should be resolved as directories or config files
  const projectsGlobMatches: string[] = []

  // directories that don't have a config file inside, but should be treated as projects
  const nonConfigProjectDirectories: string[] = []

  for (const definition of projectsDefinition) {
    if (typeof definition === 'string') {
      const stringOption = definition.replace('<rootDir>', parentConfig.root)
      // if the string doesn't contain a glob, we can resolve it directly
      // ['./vitest.config.js']
      if (!isDynamicPattern(stringOption)) {
        const file = resolve(parentConfig.root, stringOption)

        if (!existsSync(file)) {
          throw new Error(`Projects definition references a non-existing file or a directory: ${file}`)
        }

        const stats = statSync(file)
        // user can specify a config file directly
        if (stats.isFile()) {
          const name = basename(file)
          if (!CONFIG_REGEXP.test(name)) {
            throw new Error(
              `The file "${relative(parentConfig.root, file)}" must start with "vitest.config"/"vite.config" `
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
        mode: parentViteConfig.mode,
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
      cwd: parentConfig.root,
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
            `The projects glob matched a file "${relative(parentConfig.root, path)}", `
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
 * Resolve a project's name, falling back to the `package.json` name or the
 * directory/index when neither the config nor a plugin provided one.
 *
 * Projects declared by a container config are namespaced by the container's
 * name: the "unit" project of an "app" container is named "app (unit)".
 */
function resolveProjectName(
  name: string | ProjectName | undefined,
  workspacePath: string | number,
  containerLabel: string | undefined,
): ProjectName {
  let { label, color }: ProjectName = typeof name === 'string'
    ? { label: name }
    : { label: '', ...name }

  if (!label) {
    if (typeof workspacePath === 'number') {
      label = workspacePath.toString()
    }
    else {
      const dir = workspacePath.endsWith('/')
        ? workspacePath.slice(0, -1)
        : dirname(workspacePath)
      const pkgJsonPath = resolve(dir, 'package.json')
      if (existsSync(pkgJsonPath)) {
        label = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')).name
      }
      if (typeof label !== 'string' || !label) {
        label = basename(dir)
      }
    }
  }

  if (containerLabel) {
    label = `${containerLabel} (${label})`
  }

  return { label, color }
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
  const childrenByViteConfig = new Map<ResolvedViteConfig, ResolvedProjectEntry[]>()
  for (const entry of entries) {
    const children = childrenByViteConfig.get(entry.viteConfig) ?? []
    children.push(entry)
    childrenByViteConfig.set(entry.viteConfig, children)
  }

  // every entry with the root `viteConfig` (the default project, its
  // browser/benchmark variants, shared-server projects) attaches to
  // `coreWorkspaceProject`
  if (vitest.vite) {
    if (!vitest.coreWorkspaceProject) {
      vitest.coreWorkspaceProject = TestProject._createBasicProject(vitest)
      // a browser-enabled root owns the parent browser project
      // so instance siblings can attach to it
      if (vitest._rootBrowserParent) {
        vitest.coreWorkspaceProject._parentBrowser = vitest._rootBrowserParent
      }
    }
    primaryByViteConfig.set(vitest.vite.config, vitest.coreWorkspaceProject)
  }

  const projects: TestProject[] = []

  for (const entry of entries) {
    const { viteConfig, projectConfig, hidden } = entry
    const primary = primaryByViteConfig.get(viteConfig)
    if (primary) {
      if (hidden) {
        continue
      }
      // Default-project no-browser case: the entry's `projectConfig` IS the
      // root's resolved config. Use `coreWorkspaceProject` directly so
      // callers that rely on `project === vitest.getRootProject()` work
      // (and so we don't have two TestProjects representing the same root).
      if (primary === vitest.coreWorkspaceProject && projectConfig === vitest.config) {
        projects.push(vitest.coreWorkspaceProject)
        continue
      }
      // a shared-server project reuses only the Vite server; its own config
      // still decides how modules are externalized and evaluated, so it
      // needs its own resolver, fetcher, and module runner
      if (entry.sharedServer) {
        const project = new TestProject(vitest, primary.vite, viteConfig, projectConfig)
        project._initializeRunners(primary.vite)
        projects.push(project)
        continue
      }
      const sibling = TestProject._spawnSibling(primary, projectConfig)
      // Browser-instance siblings share the primary's single (browser) Vite
      // server; each gets its own `ProjectBrowser` view onto it.
      if (primary._parentBrowser) {
        sibling.browser = primary._parentBrowser.spawn(sibling)
      }
      projects.push(sibling)
      continue
    }

    // Workspace project with its own `viteConfig`: own a fresh Vite server. For
    // a browser cluster this is the single server shared by `project.vite` and
    // `project.browser.vite`.
    const children = childrenByViteConfig.get(viteConfig) ?? []
    const { server, parent } = await createClusterServer(vitest, viteConfig, projectConfig, children)
    const project = new TestProject(vitest, server, viteConfig, projectConfig)
    project._initializeRunners(server)
    if (parent) {
      project._parentBrowser = parent
    }
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
    {
      throwIfEmpty: false,
      existingNames: new Set(vitest.projects.map(p => p.name)),
    },
  )
  return attachProjectsFromEntries(vitest, entries)
}

function isChromiumName(provider: string, name: string) {
  if (provider === 'playwright') {
    return name === 'chromium'
  }
  return name === 'chrome' || name === 'edge'
}
