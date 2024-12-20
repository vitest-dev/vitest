import type { Vitest } from '../core'
import type { BrowserInstanceOption, ResolvedConfig, TestProjectConfiguration, UserConfig, UserWorkspaceConfig } from '../types/config'
import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import { limitConcurrency } from '@vitest/runner/utils'
import { deepClone, toArray } from '@vitest/utils'
import { dirname, relative, resolve } from 'pathe'
import { glob, type GlobOptions, isDynamicPattern } from 'tinyglobby'
import { mergeConfig } from 'vite'
import { configFiles as defaultConfigFiles } from '../../constants'
import { wildcardPatternToRegExp } from '../../utils/base'
import { isTTY } from '../../utils/env'
import { initializeProject, TestProject } from '../project'
import { withLabel } from '../reporters/renderers/utils'

export async function resolveWorkspace(
  vitest: Vitest,
  cliOptions: UserConfig,
  workspaceConfigPath: string | undefined,
  workspaceDefinition: TestProjectConfiguration[],
): Promise<TestProject[]> {
  const { configFiles, projectConfigs, nonConfigDirectories } = await resolveTestProjectConfigs(
    vitest,
    workspaceConfigPath,
    workspaceDefinition,
  )

  // cli options that affect the project config,
  // not all options are allowed to be overridden
  const overridesOptions = [
    'logHeapUsage',
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
      : false
    // if extends a root config, use the users root options
    const rootOptions = options.extends === true
      ? vitest._options
      : {}
    // if `root` is configured, resolve it relative to the workespace file or vite root (like other options)
    // if `root` is not specified, inline configs use the same root as the root project
    const root = options.root
      ? resolve(configRoot, options.root)
      : vitest.config.root
    projectPromises.push(concurrent(() => initializeProject(
      index,
      vitest,
      mergeConfig(rootOptions, { ...options, root, configFile }) as any,
    )))
  })

  for (const path of fileProjects) {
    // if file leads to the root config, then we can just reuse it because we already initialized it
    if (vitest.vite.config.configFile === path) {
      projectPromises.push(Promise.resolve(vitest._ensureRootProject()))
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
    return resolveBrowserWorkspace(vitest, new Set(), [vitest._ensureRootProject()])
  }

  const resolvedProjects = await Promise.all(projectPromises)
  const names = new Set<string>()

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
        : [' ']
      throw new Error([
        `Project name "${name}"`,
        project.vite.config.configFile ? ` from "${relative(vitest.config.root, project.vite.config.configFile)}"` : '',
        ' is not unique.',
        duplicate?.vite.config.configFile ? ` The project is already defined by "${relative(vitest.config.root, duplicate.vite.config.configFile)}".` : '',
        filesError,
        'All projects in a workspace should have unique names. Make sure your configuration is correct.',
      ].join(''))
    }
    names.add(name)
  }

  return resolveBrowserWorkspace(vitest, names, resolvedProjects)
}

export async function resolveBrowserWorkspace(
  vitest: Vitest,
  names: Set<string>,
  resolvedProjects: TestProject[],
) {
  const filters = toArray(vitest.config.project).map(s => wildcardPatternToRegExp(s))
  const removeProjects = new Set<TestProject>()

  resolvedProjects.forEach((project) => {
    if (!project.config.browser.enabled) {
      return
    }
    const configs = project.config.browser.instances || []
    if (configs.length === 0) {
      // browser.name should be defined, otherwise the config fails in "resolveConfig"
      configs.push({ browser: project.config.browser.name })
      console.warn(
        withLabel(
          'yellow',
          'Vitest',
          [
            `No browser "instances" were defined`,
            project.name ? ` for the "${project.name}" project. ` : '. ',
            `Running tests in "${project.config.browser.name}" browser. `,
            'The "browser.name" field is deprecated since Vitest 3. ',
            'Read more: https://vitest.dev/guide/browser/config#browser-instances',
          ].filter(Boolean).join(''),
        ),
      )
    }
    const originalName = project.config.name
    const filteredConfigs = !filters.length
      ? configs
      : configs.filter((config) => {
        const browser = config.browser
        const newName = config.name || (originalName ? `${originalName} (${browser})` : browser)
        return filters.some(pattern => pattern.test(newName))
      })

    // every project was filtered out
    if (!filteredConfigs.length) {
      return
    }

    if (project.config.browser.providerOptions) {
      vitest.logger.warn(
        withLabel('yellow', 'Vitest', `"providerOptions"${originalName ? ` in "${originalName}" project` : ''} is ignored because it's overriden by the configs. To hide this warning, remove the "providerOptions" property from the browser configuration.`),
      )
    }

    filteredConfigs.forEach((config, index) => {
      const browser = config.browser
      if (!browser) {
        const nth = index + 1
        const ending = nth === 2 ? 'nd' : nth === 3 ? 'rd' : 'th'
        throw new Error(`The browser configuration must have a "browser" property. The ${nth}${ending} item in "browser.instances" doesn't have it. Make sure your${originalName ? ` "${originalName}"` : ''} configuration is correct.`)
      }
      const name = config.name
      const newName = name || (originalName ? `${originalName} (${browser})` : browser)

      if (names.has(newName)) {
        throw new Error(
          [
            `Cannot define a nested project for a ${browser} browser. The project name "${newName}" was already defined. `,
            'If you have multiple instances for the same browser, make sure to define a custom "name". ',
            'All projects in a workspace should have unique names. Make sure your configuration is correct.',
          ].join(''),
        )
      }
      names.add(newName)
      const clonedConfig = cloneConfig(project, config)
      clonedConfig.name = newName
      const clone = TestProject._cloneBrowserProject(project, clonedConfig)
      resolvedProjects.push(clone)
    })

    removeProjects.add(project)
  })

  resolvedProjects = resolvedProjects.filter(project => !removeProjects.has(project))

  const headedBrowserProjects = resolvedProjects.filter((project) => {
    return project.config.browser.enabled && !project.config.browser.headless
  })
  if (headedBrowserProjects.length > 1) {
    const message = [
      `Found multiple projects that run browser tests in headed mode: "${headedBrowserProjects.map(p => p.name).join('", "')}".`,
      ` Vitest cannot run multiple headed browsers at the same time.`,
    ].join('')
    if (!isTTY) {
      throw new Error(`${message} Please, filter projects with --browser=name or --project=name flag or run tests with "headless: true" option.`)
    }
    const prompts = await import('prompts')
    const { projectName } = await prompts.default({
      type: 'select',
      name: 'projectName',
      choices: headedBrowserProjects.map(project => ({
        title: project.name,
        value: project.name,
      })),
      message: `${message} Select a single project to run or cancel and run tests with "headless: true" option. Note that you can also start tests with --browser=name or --project=name flag.`,
    })
    if (!projectName) {
      throw new Error('The test run was aborted.')
    }
    return resolvedProjects.filter(project => project.name === projectName)
  }

  return resolvedProjects
}

function cloneConfig(project: TestProject, { browser, ...config }: BrowserInstanceOption) {
  const {
    locators,
    viewport,
    testerHtmlPath,
    headless,
    screenshotDirectory,
    screenshotFailures,
    // @ts-expect-error remove just in case
    browser: _browser,
    name,
    ...overrideConfig
  } = config
  const currentConfig = project.config.browser
  return mergeConfig<any, any>({
    ...deepClone(project.config),
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
      // TODO: test that CLI arg is preferred over the local config
      headless: project.vitest._options?.browser?.headless ?? headless ?? currentConfig.headless,
      name: browser,
      providerOptions: config,
      instances: undefined, // projects cannot spawn more configs
    },
    // TODO: should resolve, not merge/override
  } satisfies ResolvedConfig, overrideConfig) as ResolvedConfig
}

async function resolveTestProjectConfigs(
  vitest: Vitest,
  workspaceConfigPath: string | undefined,
  workspaceDefinition: TestProjectConfiguration[],
) {
  // project configurations that were specified directly
  const projectsOptions: (UserWorkspaceConfig & { extends?: true | string })[] = []

  // custom config files that were specified directly or resolved from a directory
  const workspaceConfigFiles: string[] = []

  // custom glob matches that should be resolved as directories or config files
  const workspaceGlobMatches: string[] = []

  // directories that don't have a config file inside, but should be treated as projects
  const nonConfigProjectDirectories: string[] = []

  for (const definition of workspaceDefinition) {
    if (typeof definition === 'string') {
      const stringOption = definition.replace('<rootDir>', vitest.config.root)
      // if the string doesn't contain a glob, we can resolve it directly
      // ['./vitest.config.js']
      if (!isDynamicPattern(stringOption)) {
        const file = resolve(vitest.config.root, stringOption)

        if (!existsSync(file)) {
          const relativeWorkpaceConfigPath = workspaceConfigPath
            ? relative(vitest.config.root, workspaceConfigPath)
            : undefined
          const note = workspaceConfigPath ? `Workspace config file "${relativeWorkpaceConfigPath}"` : 'Inline workspace'
          throw new Error(`${note} references a non-existing file or a directory: ${file}`)
        }

        const stats = await fs.stat(file)
        // user can specify a config file directly
        if (stats.isFile()) {
          workspaceConfigFiles.push(file)
        }
        // user can specify a directory that should be used as a project
        else if (stats.isDirectory()) {
          const configFile = await resolveDirectoryConfig(file)
          if (configFile) {
            workspaceConfigFiles.push(configFile)
          }
          else {
            const directory = file[file.length - 1] === '/' ? file : `${file}/`
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
        workspaceGlobMatches.push(stringOption)
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

  if (workspaceGlobMatches.length) {
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

    const workspacesFs = await glob(workspaceGlobMatches, globOptions)

    await Promise.all(workspacesFs.map(async (path) => {
      // directories are allowed with a glob like `packages/*`
      // in this case every directory is treated as a project
      if (path.endsWith('/')) {
        const configFile = await resolveDirectoryConfig(path)
        if (configFile) {
          workspaceConfigFiles.push(configFile)
        }
        else {
          nonConfigProjectDirectories.push(path)
        }
      }
      else {
        workspaceConfigFiles.push(path)
      }
    }))
  }

  const projectConfigFiles = Array.from(new Set(workspaceConfigFiles))

  return {
    projectConfigs: projectsOptions,
    nonConfigDirectories: nonConfigProjectDirectories,
    configFiles: projectConfigFiles,
  }
}

async function resolveDirectoryConfig(directory: string) {
  const files = new Set(await fs.readdir(directory))
  // default resolution looks for vitest.config.* or vite.config.* files
  // this simulates how `findUp` works in packages/vitest/src/node/create.ts:29
  const configFile = defaultConfigFiles.find(file => files.has(file))
  if (configFile) {
    return resolve(directory, configFile)
  }
  return null
}
