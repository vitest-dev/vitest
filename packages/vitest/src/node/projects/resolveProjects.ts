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
import { createDebugger } from '../../utils/debugger'
import { limitConcurrency } from '../../utils/limit-concurrency'
import { CaptureRawTestConfig, isExcludedByProjectFilter, matchesProjectFilter, resolveTestConfig } from '../config/resolveConfig'
import { BrowserLoaderPlugin, createClusterServer } from '../plugins/browserLoader'
import { resolveTestOptions, TestConfigPlugin } from '../plugins/testConfig'
import { WorkspaceVitestPlugin } from '../plugins/workspace'
import { TestProject } from '../project'
import { globProjectTestFiles } from './globProjectFiles'

const debug = createDebugger('vitest:projects')

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
  'maxWorkers',
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
    debug?.(`resolving ${definitions.length} project definitions declared by ${globalViteConfig.configFile ?? globalConfig.root}`)
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
    debug?.(`no projects declared, the root config is the only project`)
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

  const afterBrowser = expandBrowserInstancesInEntries(globalConfig, baseEntries, seenNamesSet)
  const afterBenchmark = expandBenchmarksInEntries(afterBrowser, seenNamesSet, !!globalConfig.cliOptions.benchmarkOnly)

  // --project filter applied after expansion so all candidate names are known.
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

  debug?.(`resolved projects: ${filtered.filter(e => !e.hidden).map(e => projectLabel(e.projectConfig.name)).join(', ')}`)

  await applyBrowserOptimizeDeps(harness, filtered)

  return filtered
}

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
      debug?.(`aggregating browser optimizeDeps from ${testFiles.length} test files of ${projectEntries.map(e => projectLabel(e.projectConfig.name)).join(', ')}`)
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

interface ProjectsResolutionContext {
  harness: PluginHarness
  rootViteConfig: ResolvedViteConfig
  rootConfig: ResolvedConfig
  /** The config that defines the `projects` - it could be the same as the root */
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
    const ownServerReason = getOwnServerReason(context, options)
    if (ownServerReason === undefined) {
      debug?.(`inline project ${inlineProjectLabel(options, index)} shares the Vite server of ${parentViteConfig.configFile ?? parentConfig.root}`)
      promises.push(Promise.resolve().then(() => resolveSharedServerEntry(context, options, index)))
      return
    }
    debug?.(`inline project ${inlineProjectLabel(options, index)} resolves its own Vite config: ${ownServerReason}`)

    const configRoot = parentConfig.root
    // if extends a config file, resolve the file path
    const configFile = typeof options.extends === 'string'
      ? resolve(configRoot, options.extends)
      : options.extends !== false
        ? (parentViteConfig.configFile || false)
        : false
    // `test.root` overrides the top level `root`, so the entry carries a
    // single resolved root; both are resolved relative to the declaring
    // config's root (like other options), and inline configs without a
    // root use the same root as the declaring config
    const { root: testRoot, ...test } = options.test ?? {}
    const customRoot = testRoot ?? options.root
    const root = customRoot ? resolve(configRoot, customRoot) : configRoot

    promises.push(concurrent(() => resolveSingleProjectEntry(context, {
      ...options,
      test,
      root,
      configFile,
    }, index)))
  })

  for (const path of fileProjects) {
    // if the file leads to the declaring config itself, reuse the already
    // resolved pair: the root (or the container) also runs as a regular project
    if (parentViteConfig.configFile === path) {
      debug?.(`project at ${path} is the declaring config itself, reusing its resolved config`)
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

    debug?.(`project at ${path} resolves its own Vite config: file and directory projects never share the server`)
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
    debug?.(`config "${relativeFile}" is a container declaring ${definitions.length} project definitions, it doesn't run tests itself`)
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

function inheritRootViteOverrides(
  rootConfig: ResolvedConfig,
  options: ViteInlineConfig,
): ViteInlineConfig {
  // `plugins` are already initialised, keeping them would break isolation
  const { plugins: _plugins, ...rootViteOverrides } = rootConfig.viteOverrides
  // cloned so plugins that mutate inherited arrays in place don't share
  // them between the root and every project
  const inherited = deepClone(rootViteOverrides)
  // `tagsFilter` is CLI-only; `PROJECT_CLI_OVERRIDES` applies it per project
  delete (inherited.test as UserConfig | undefined)?.tagsFilter
  // `browser` describes the instances of a single project; inheriting it
  // would create duplicate instance names (the `--browser` flags have the
  // same guard in `vitest:config:cli`)
  delete (inherited.test as UserConfig | undefined)?.browser
  return mergeConfig(inherited, options)
}

// test options that reach the Vite config during a project's resolution:
// `alias` is hoisted into `resolve.alias`, `css` configures CSS processing
// and scoped class names, `mode` selects env files and plugin behavior,
// `root` anchors the server, and `browser` selects a browser server
const VITE_AFFECTING_TEST_OPTIONS = ['alias', 'browser', 'css', 'mode', 'root'] as const

function projectLabel(name: string): string {
  return name ? `"${name}"` : '(root)'
}

function inlineProjectLabel(options: UserWorkspaceConfig, index: number): string {
  const name = options.test?.name
  const label = typeof name === 'string' ? name : name?.label
  return label ? `"${label}"` : `at index ${index}`
}

function getOwnServerReason(
  context: ProjectsResolutionContext,
  options: UserWorkspaceConfig & { extends?: boolean | string },
): string | undefined {
  if (!context.rootConfig.sharedViteServer) {
    return '`sharedViteServer` is disabled'
  }
  const rawParentTest = context.parentConfig._rawTestConfig
  if (rawParentTest === undefined) {
    return 'the raw `test` options of the declaring config are not available'
  }
  if (options.extends !== undefined && options.extends !== true) {
    return '`extends` doesn\'t point to the declaring config'
  }
  for (const key in options) {
    if (key === 'test' || key === 'extends') {
      continue
    }
    const value = options[key as keyof typeof options]
    if (value === undefined) {
      continue
    }
    if (key === 'plugins' && hasNoPlugins(value)) {
      continue
    }
    // `define` is applied at runtime and doesn't affect the server
    if (key === 'define') {
      continue
    }
    return `\`${key}\` changes the Vite config`
  }
  // an inherited `browser` config makes the project a browser project, which
  // needs its own browser server; other inherited values are safe
  if (rawParentTest.browser) {
    return 'the inherited `browser` config needs a browser server'
  }
  const test = options.test
  if (!test) {
    return undefined
  }
  const affecting = VITE_AFFECTING_TEST_OPTIONS.find(option => test[option as keyof typeof test] !== undefined)
  if (affecting) {
    return `\`test.${affecting}\` affects the Vite config`
  }
  // the dependency optimizer state (scanned deps, rewritten import URLs)
  // belongs to the server, and `deps.moduleDirectories` configures the
  // server's `resolve` options
  const deps = test.deps
  if (deps?.optimizer !== undefined) {
    return '`test.deps.optimizer` affects the Vite config'
  }
  if (deps?.moduleDirectories !== undefined) {
    return '`test.deps.moduleDirectories` affects the Vite config'
  }
  return undefined
}

// covers `plugins: condition ? [plugin()] : []`
function hasNoPlugins(plugins: unknown): boolean {
  return Array.isArray(plugins)
    && plugins.every(plugin => !plugin || (Array.isArray(plugin) && hasNoPlugins(plugin)))
}

// `deleteDefineConfig` always drops these
const DROPPED_DEFINE_KEYS = ['process.env', 'process', 'global']

// mirrors `deleteDefineConfig`: a string is a code replacement unless it parses as JSON
function parseDefineValue(value: unknown): { parsed: boolean; value?: any } {
  if (typeof value !== 'string') {
    return { parsed: true, value }
  }
  try {
    return { parsed: true, value: JSON.parse(value) }
  }
  catch {
    return { parsed: false }
  }
}

interface SharedProjectDefines {
  defines: ResolvedConfig['defines']
  scriptDefines: Record<string, any> | undefined
}

// the runtime part of `deleteDefineConfig` for a project that shares the parent server
function resolveSharedProjectDefines(
  define: Record<string, any> | undefined,
  parentConfig: ResolvedConfig,
): SharedProjectDefines {
  if (!define) {
    return { defines: parentConfig.defines, scriptDefines: parentConfig._scriptDefines }
  }
  let defines = parentConfig.defines
  let scriptDefines = parentConfig._scriptDefines
  const copyDefines = () => {
    if (defines === parentConfig.defines) {
      defines = { ...parentConfig.defines }
    }
    return defines
  }
  for (const key in define) {
    // `import.meta.vitest` is injected per test file for in-source testing
    if (DROPPED_DEFINE_KEYS.includes(key) || key === 'import.meta.vitest') {
      continue
    }
    const result = parseDefineValue(define[key])
    if (result.parsed && key.startsWith('import.meta.env.')) {
      process.env[key.slice('import.meta.env.'.length)] = result.value
    }
    else if (result.parsed && key.startsWith('process.env.')) {
      process.env[key.slice('process.env.'.length)] = result.value
    }
    else if (result.parsed && !key.includes('.')) {
      copyDefines()[key] = result.value
    }
    else {
      if (scriptDefines === undefined || scriptDefines === parentConfig._scriptDefines) {
        scriptDefines = { ...parentConfig._scriptDefines }
      }
      scriptDefines[key] = define[key]
      if (key in defines) {
        // the script runs before the runtime defines are assigned,
        // an inherited value would override the entry
        delete copyDefines()[key]
      }
    }
  }
  return { defines, scriptDefines }
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

  const { defines, scriptDefines } = resolveSharedProjectDefines(options.define, parentConfig)

  const mergedOptions = resolveTestOptions(merged, {
    harness,
    cliOptions: cliOverrides,
    globalConfig: rootConfig,
    project: { options, extendsTrueRootConfig: parentConfig === rootConfig },
    sharedServer: {
      defines,
      scriptDefines,
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
      ...WorkspaceVitestPlugin(harness, parentViteConfig),
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

  debug?.(`resolved the Vite config of project "${projectConfig.name}" (${configFile || options.root})`)

  return {
    viteConfig: projectViteConfig,
    projectConfig,
    inline: isInlineEntry,
    ancestors: context.ancestors.length ? [...context.ancestors] : undefined,
  }
}

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
      debug?.(`browser project ${projectLabel(parentName)} is dropped: ${instances.length === 0 ? 'it has no instances' : 'it is excluded by the --project filter'}`)
      continue
    }

    const parentMatches = matchesEntryFilter(globalConfig.project, parentName, entry.ancestors)
    const filteredInstances = instances.filter(instance => parentMatches
      ? !isExcludedByProjectFilter(globalConfig.project, instance.name!)
      : matchesProjectFilter(globalConfig.project, instance.name!))
    if (!filteredInstances.length) {
      debug?.(`browser project ${projectLabel(parentName)} is dropped: no instances match the --project filter`)
      continue
    }

    // Keep the parent in the entry list as `hidden` so a `TestProject` is
    // created (instances link to it via `_parent` for the browser provider).
    // The parent's name is removed from `names` because the instance names
    // take its place in the user-facing project list.
    names.delete(parentName)
    result.push({ ...entry, hidden: true })
    debug?.(`browser project ${projectLabel(parentName)} expands into instances: ${filteredInstances.map(i => `"${i.name}"`).join(', ')}`)

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
    debug?.(`benchmark project "${name}" is added for ${projectLabel(entry.projectConfig.name)}`)

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
    const matches = matchesEntryFilter(filter, entry.projectConfig.name, entry.ancestors)
    if (!matches) {
      debug?.(`project ${projectLabel(entry.projectConfig.name)} is dropped by the --project filter: ${filter.join(', ')}`)
    }
    return matches
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

function matchesEntryFilter(
  filter: string[],
  name: string,
  ancestors: string[] | undefined,
): boolean {
  if (!filter.length) {
    return true
  }
  if (isEntryExcludedByFilter(filter, name, ancestors)) {
    return false
  }
  const positives = filter.filter(project => !project.startsWith('!'))
  if (!positives.length) {
    return true
  }
  const names = [name, ...(ancestors || [])]
  return positives.some((project) => {
    const regexp = wildcardPatternToRegExp(project)
    return names.some(candidate => regexp.test(candidate))
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
    debug?.(`projects glob ${projectsGlobMatches.map(p => `"${p}"`).join(', ')} matched ${projectsFs.length} paths`)

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

  // Projects declared by a container config are namespaced by the container's
  // name: the "unit" project of an "app" container is named "app (unit)".
  if (containerLabel) {
    label = `${containerLabel} (${label})`
  }

  return { label, color }
}

export async function attachProjectsFromEntries(
  vitest: Vitest,
  entries: ResolvedProjectEntry[],
): Promise<TestProject[]> {
  // For each unique `viteConfig`, the "primary" project owns the server.
  // Siblings (browser instance variants, benchmark variants) share it via `_parent`.
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
      // root's resolved config.
      if (primary === vitest.coreWorkspaceProject && projectConfig === vitest.config) {
        projects.push(vitest.coreWorkspaceProject)
        continue
      }
      // a shared-server project reuses only the Vite server
      if (entry.sharedServer) {
        debug?.(`project ${projectLabel(projectConfig.name)} reuses the Vite server of ${projectLabel(primary.name)} with its own module runner`)
        const project = new TestProject(vitest, primary.vite, viteConfig, projectConfig)
        project._sharedViteServer = true
        project._initializeRunners(primary.vite)
        projects.push(project)
        continue
      }
      debug?.(`project ${projectLabel(projectConfig.name)} shares the Vite server and module runner of ${projectLabel(primary.name)}`)
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
    debug?.(`creating a Vite server for project ${projectLabel(projectConfig.name)}`)
    const children = childrenByViteConfig.get(viteConfig) ?? []
    const { server, parent } = await createClusterServer(vitest, viteConfig, projectConfig, children)
    const project = new TestProject(vitest, server, viteConfig, projectConfig)
    // a shared entry can create the container's server on first use,
    // but the server still belongs to the declaring config
    project._sharedViteServer = !!entry.sharedServer
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
  debug?.(`injecting ${definitions.length} project definitions at runtime`)
  const vitest = harness.getVitest()
  const entries = await resolveProjectEntries(
    harness,
    vitest.viteConfig,
    vitest.config,
    definitions,
    {
      // filtering an injected project out is expected at runtime (the user can
      // call `injectTestProjects` with a name that doesn't match the active filter;
      // we just return an empty list).
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
