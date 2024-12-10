import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { TestProjectConfiguration, UserConfig, UserWorkspaceConfig } from '../types/config'
import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import { limitConcurrency } from '@vitest/runner/utils'
import fg from 'fast-glob'
import { dirname, relative, resolve } from 'pathe'
import { mergeConfig } from 'vite'
import { configFiles as defaultConfigFiles } from '../../constants'
import { initializeProject } from '../project'
import { isDynamicPattern } from './fast-glob-pattern'

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
    return [vitest._ensureRootProject()]
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

  return resolvedProjects
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
    const globOptions: fg.Options = {
      absolute: true,
      dot: true,
      onlyFiles: false,
      cwd: vitest.config.root,
      markDirectories: true,
      // TODO: revert option when we go back to tinyglobby
      // expandDirectories: false,
      ignore: [
        '**/node_modules/**',
        // temporary vite config file
        '**/*.timestamp-*',
        // macOS directory metadata
        '**/.DS_Store',
      ],
    }

    const workspacesFs = await fg.glob(workspaceGlobMatches, globOptions)

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
