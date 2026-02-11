import type { GlobOptions } from 'tinyglobby'
import type { Vitest } from '../core'
import type {
  BrowserInstanceOption,
  ResolvedConfig,
  TestProjectConfiguration,
  UserConfig,
  UserWorkspaceConfig,
} from '../types/config'
import { existsSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import { limitConcurrency } from '@vitest/runner/utils'
import { deepClone } from '@vitest/utils/helpers'
import { basename, dirname, relative, resolve } from 'pathe'
import { glob, isDynamicPattern } from 'tinyglobby'
import { mergeConfig } from 'vite'
import { configFiles as defaultConfigFiles } from '../../constants'
import { VitestFilteredOutProjectError } from '../errors'
import { initializeProject, TestProject } from '../project'

// vitest.config.*
// vite.config.*
// vitest.unit.config.*
// vite.unit.config.*
const CONFIG_REGEXP = /^vite(?:st)?(?:\.\w+)?\.config\./

export async function resolveProjects(
  vitest: Vitest,
  cliOptions: UserConfig,
  workspaceConfigPath: string | undefined,
  projectsDefinition: TestProjectConfiguration[],
  names: Set<string>,
): Promise<TestProject[]> {
  const { configFiles, projectConfigs, nonConfigDirectories } = await resolveTestProjectConfigs(
    vitest,
    workspaceConfigPath,
    projectsDefinition,
  )

  // cli options that affect the project config,
  // not all options are allowed to be overridden
  const overridesOptions = [
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

  const cliOverrides = overridesOptions.reduce((acc, name) => {
    if (name in cliOptions) {
      acc[name] = cliOptions[name] as any
    }
    return acc
  }, {} as UserConfig)

  const projectPromises: Promise<TestProject>[] = []
  const fileProjects = [...configFiles, ...nonConfigDirectories]
  const concurrent = limitConcurrency(os.availableParallelism?.() || os.cpus().length || 5)

  projectConfigs.forEach((options, index) => {
    const configRoot = workspaceConfigPath ? dirname(workspaceConfigPath) : vitest.config.root
    // if extends a config file, resolve the file path
    const configFile = typeof options.extends === 'string'
      ? resolve(configRoot, options.extends)
      : options.extends === true
        ? (vitest.vite.config.configFile || false)
        : false
    // if `root` is configured, resolve it relative to the workspace file or vite root (like other options)
    // if `root` is not specified, inline configs use the same root as the root project
    const root = options.root
      ? resolve(configRoot, options.root)
      : vitest.config.root
    projectPromises.push(concurrent(() => initializeProject(
      index,
      vitest,
      {
        ...options,
        root,
        configFile,
        plugins: [
          {
            name: 'vitest:tags',
            // don't inherit tags from workspace config, they are merged separately
            configResolved(config) {
              ;(config as any).test ??= {}
              config.test!.tags = options.test?.tags
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
      },
    )))
  })

  for (const path of fileProjects) {
    // if file leads to the root config, then we can just reuse it because we already initialized it
    if (vitest.vite.config.configFile === path) {
      const project = getDefaultTestProject(vitest)
      if (project) {
        projectPromises.push(Promise.resolve(project))
      }
      continue
    }

    const configFile = path.endsWith('/') ? false : path
    const root = path.endsWith('/') ? path : dirname(path)

    projectPromises.push(
      concurrent(() => initializeProject(
        path,
        vitest,
        { root, configFile, test: cliOverrides },
      )),
    )
  }

  // pretty rare case - the glob didn't match anything and there are no inline configs
  if (!projectPromises.length) {
    throw new Error(
      [
        'No projects were found. Make sure your configuration is correct. ',
        vitest.config.project.length ? `The filter matched no projects: ${vitest.config.project.join(', ')}. ` : '',
        `The projects definition: ${JSON.stringify(projectsDefinition, null, 4)}.`,
      ].join(''),
    )
  }

  const resolvedProjectsPromises = await Promise.allSettled(projectPromises)

  const errors: Error[] = []
  const resolvedProjects: TestProject[] = []

  for (const result of resolvedProjectsPromises) {
    if (result.status === 'rejected') {
      if (result.reason instanceof VitestFilteredOutProjectError) {
        // filter out filtered out projects
        continue
      }
      errors.push(result.reason)
    }
    else {
      resolvedProjects.push(result.value)
    }
  }

  if (errors.length) {
    throw new AggregateError(
      errors,
      'Failed to initialize projects. There were errors during projects setup. See below for more details.',
    )
  }

  // project names are guaranteed to be unique
  for (const project of resolvedProjects) {
    const name = project.name
    if (names.has(name)) {
      const duplicate = resolvedProjects.find(p => p.name === name && p !== project)!
      const filesError = fileProjects.length
        ? [
            '\n\nYour config matched these files:\n',
            fileProjects.map(p => ` - ${relative(vitest.config.root, p)}`).join('\n'),
            '\n\n',
          ].join('')
        : ' '
      throw new Error([
        `Project name "${name}"`,
        project.vite.config.configFile ? ` from "${relative(vitest.config.root, project.vite.config.configFile)}"` : '',
        ' is not unique.',
        duplicate?.vite.config.configFile ? ` The project is already defined by "${relative(vitest.config.root, duplicate.vite.config.configFile)}".` : '',
        filesError,
        'All projects should have unique names. Make sure your configuration is correct.',
      ].join(''))
    }
    names.add(name)
  }

  return resolveBrowserProjects(vitest, names, resolvedProjects)
}

export async function resolveBrowserProjects(
  vitest: Vitest,
  names: Set<string>,
  resolvedProjects: TestProject[],
): Promise<TestProject[]> {
  const removeProjects = new Set<TestProject>()

  resolvedProjects.forEach((project) => {
    if (!project.config.browser.enabled) {
      return
    }
    const instances = project.config.browser.instances || []
    if (instances.length === 0) {
      removeProjects.add(project)
      return
    }
    const originalName = project.config.name
    // if original name is in the --project=name filter, keep all instances
    const filteredInstances = vitest.matchesProjectFilter(originalName)
      ? instances
      : instances.filter((instance) => {
          const newName = instance.name! // name is set in "workspace" plugin
          return vitest.matchesProjectFilter(newName)
        })

    // every project was filtered out
    if (!filteredInstances.length) {
      removeProjects.add(project)
      return
    }

    filteredInstances.forEach((config, index) => {
      const browser = config.browser
      if (!browser) {
        const nth = index + 1
        const ending = nth === 2 ? 'nd' : nth === 3 ? 'rd' : 'th'
        throw new Error(`The browser configuration must have a "browser" property. The ${nth}${ending} item in "browser.instances" doesn't have it. Make sure your${originalName ? ` "${originalName}"` : ''} configuration is correct.`)
      }
      const name = config.name

      if (name == null) {
        throw new Error(`The browser configuration must have a "name" property. This is a bug in Vitest. Please, open a new issue with reproduction`)
      }
      if (config.provider?.name != null && project.config.browser.provider?.name != null && config.provider?.name !== project.config.browser.provider?.name) {
        throw new Error(`The instance cannot have a different provider from its parent. The "${name}" instance specifies "${config.provider?.name}" provider, but its parent has a "${project.config.browser.provider?.name}" provider.`)
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
      const clonedConfig = cloneConfig(project, config)
      clonedConfig.name = name
      const clone = TestProject._cloneBrowserProject(project, clonedConfig)
      resolvedProjects.push(clone)
    })

    removeProjects.add(project)
  })

  return resolvedProjects.filter(project => !removeProjects.has(project))
}

function cloneConfig(project: TestProject, { browser, ...config }: BrowserInstanceOption) {
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
  const currentConfig = project.config.browser
  const clonedConfig = deepClone(project.config)
  return mergeConfig<any, any>({
    ...clonedConfig,
    browser: {
      ...project.config.browser,
      locators: locators
        ? {
            testIdAttribute: locators.testIdAttribute ?? currentConfig.locators.testIdAttribute,
          }
        : project.config.browser.locators,
      viewport: viewport ?? currentConfig.viewport,
      testerHtmlPath: testerHtmlPath ?? currentConfig.testerHtmlPath,
      screenshotDirectory: screenshotDirectory ?? currentConfig.screenshotDirectory,
      screenshotFailures: screenshotFailures ?? currentConfig.screenshotFailures,
      headless: headless ?? currentConfig.headless,
      provider: provider ?? currentConfig.provider,
      fileParallelism: fileParallelism ?? currentConfig.fileParallelism,
      name: browser,
      instances: [], // projects cannot spawn more configs
    },
    // If there is no include or exclude or includeSource pattern in browser.instances[], we should use the that's pattern from the parent project
    include: (overrideConfig.include && overrideConfig.include.length > 0) ? [] : clonedConfig.include,
    exclude: (overrideConfig.exclude && overrideConfig.exclude.length > 0) ? [] : clonedConfig.exclude,
    includeSource: (overrideConfig.includeSource && overrideConfig.includeSource.length > 0) ? [] : clonedConfig.includeSource,
    // TODO: should resolve, not merge/override
  } satisfies ResolvedConfig, overrideConfig) as ResolvedConfig
}

async function resolveTestProjectConfigs(
  vitest: Vitest,
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
      const stringOption = definition.replace('<rootDir>', vitest.config.root)
      // if the string doesn't contain a glob, we can resolve it directly
      // ['./vitest.config.js']
      if (!isDynamicPattern(stringOption)) {
        const file = resolve(vitest.config.root, stringOption)

        if (!existsSync(file)) {
          const relativeWorkspaceConfigPath = workspaceConfigPath
            ? relative(vitest.config.root, workspaceConfigPath)
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
              `The file "${relative(vitest.config.root, file)}" must start with "vitest.config"/"vite.config" `
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
        command: vitest.vite.config.command,
        mode: vitest.vite.config.mode,
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
      cwd: vitest.config.root,
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
            `The projects glob matched a file "${relative(vitest.config.root, path)}", `
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

export function getDefaultTestProject(vitest: Vitest): TestProject | null {
  const filter = vitest.config.project
  const project = vitest._ensureRootProject()
  if (!filter.length) {
    return project
  }
  // check for the project name and browser names
  const hasProjects = getPotentialProjectNames(project).some(p =>
    vitest.matchesProjectFilter(p),
  )
  if (hasProjects) {
    return project
  }
  return null
}

function getPotentialProjectNames(project: TestProject) {
  const names = [project.name]
  if (project.config.browser.instances) {
    names.push(...project.config.browser.instances.map(i => i.name!))
  }
  else if (project.config.browser.name) {
    names.push(project.config.browser.name)
  }
  return names
}
