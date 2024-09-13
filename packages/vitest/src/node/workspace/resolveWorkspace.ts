import { existsSync, promises as fs } from 'node:fs'
import { isMainThread } from 'node:worker_threads'
import { dirname, relative, resolve } from 'pathe'
import { type GlobOptions, glob } from 'tinyglobby'
import { mergeConfig } from 'vite'
import type { Vitest } from '../core'
import type { UserConfig, UserWorkspaceConfig, WorkspaceProjectConfiguration } from '../types/config'
import type { WorkspaceProject } from '../workspace'
import { initializeProject } from '../workspace'
import { configFiles as defaultConfigFiles } from '../../constants'

export async function resolveWorkspace(
  vitest: Vitest,
  cliOptions: UserConfig,
  workspaceConfigPath: string,
  workspaceDefinition: WorkspaceProjectConfiguration[],
): Promise<WorkspaceProject[]> {
  const { configFiles, projectConfigs, nonConfigDirectories } = await resolveWorkspaceProjectConfigs(
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

  const cwd = process.cwd()

  const projects: WorkspaceProject[] = []
  const fileProjects = [...configFiles, ...nonConfigDirectories]

  try {
    // we have to resolve them one by one because CWD should depend on the project
    for (const filepath of fileProjects) {
      // if file leads to the root config, then we can just reuse it because we already initialized it
      if (vitest.server.config.configFile === filepath) {
        const project = await vitest._createCoreProject()
        projects.push(project)
        continue
      }

      const directory = filepath.endsWith('/')
        ? filepath.slice(0, -1)
        : dirname(filepath)

      if (isMainThread) {
        process.chdir(directory)
      }
      projects.push(
        await initializeProject(
          filepath,
          vitest,
          { workspaceConfigPath, test: cliOverrides },
        ),
      )
    }
  }
  finally {
    if (isMainThread) {
      process.chdir(cwd)
    }
  }

  const projectPromises: Promise<WorkspaceProject>[] = []

  projectConfigs.forEach((options, index) => {
    // we can resolve these in parallel because process.cwd() is not changed
    projectPromises.push(initializeProject(
      index,
      vitest,
      mergeConfig(options, { workspaceConfigPath, test: cliOverrides }) as any,
    ))
  })

  // pretty rare case - the glob didn't match anything and there are no inline configs
  if (!projects.length && !projectPromises.length) {
    return [await vitest._createCoreProject()]
  }

  const resolvedProjects = await Promise.all([
    ...projects,
    ...projectPromises,
  ])
  const names = new Set<string>()

  // project names are guaranteed to be unique
  for (const project of resolvedProjects) {
    const name = project.getName()
    if (names.has(name)) {
      const duplicate = resolvedProjects.find(p => p.getName() === name && p !== project)!
      const filesError = fileProjects.length
        ? [
            '\n\nYour config matched these files:\n',
            fileProjects.map(p => ` - ${relative(vitest.config.root, p)}`).join('\n'),
            '\n\n',
          ].join('')
        : [' ']
      throw new Error([
        `Project name "${name}"`,
        project.server.config.configFile ? ` from "${relative(vitest.config.root, project.server.config.configFile)}"` : '',
        ' is not unique.',
        duplicate?.server.config.configFile ? ` The project is already defined by "${relative(vitest.config.root, duplicate.server.config.configFile)}".` : '',
        filesError,
        'All projects in a workspace should have unique names. Make sure your configuration is correct.',
      ].join(''))
    }
    names.add(name)
  }

  return resolvedProjects
}

async function resolveWorkspaceProjectConfigs(
  vitest: Vitest,
  workspaceConfigPath: string,
  workspaceDefinition: WorkspaceProjectConfiguration[],
) {
  // project configurations that were specified directly
  const projectsOptions: UserWorkspaceConfig[] = []

  // custom config files that were specified directly or resolved from a directory
  const workspaceConfigFiles: string[] = []

  // custom glob matches that should be resolved as directories or config files
  const workspaceGlobMatches: string[] = []

  // directories that don't have a config file inside, but should be treated as projects
  const nonConfigProjectDirectories: string[] = []

  const relativeWorkpaceConfigPath = relative(vitest.config.root, workspaceConfigPath)

  for (const definition of workspaceDefinition) {
    if (typeof definition === 'string') {
      const stringOption = definition.replace('<rootDir>', vitest.config.root)
      // if the string doesn't contain a glob, we can resolve it directly
      // ['./vitest.config.js']
      if (!stringOption.includes('*')) {
        const file = resolve(vitest.config.root, stringOption)

        if (!existsSync(file)) {
          throw new Error(`Workspace config file "${relativeWorkpaceConfigPath}" references a non-existing file or a directory: ${file}`)
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
        command: vitest.server.config.command,
        mode: vitest.server.config.mode,
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
      ignore: ['**/node_modules/**', '**/*.timestamp-*'],
    }

    const workspacesFs = await glob(workspaceGlobMatches, globOptions)

    await Promise.all(workspacesFs.map(async (filepath) => {
      // directories are allowed with a glob like `packages/*`
      // in this case every directory is treated as a project
      if (filepath.endsWith('/')) {
        const configFile = await resolveDirectoryConfig(filepath)
        if (configFile) {
          workspaceConfigFiles.push(configFile)
        }
        else {
          nonConfigProjectDirectories.push(filepath)
        }
      }
      else {
        workspaceConfigFiles.push(filepath)
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
