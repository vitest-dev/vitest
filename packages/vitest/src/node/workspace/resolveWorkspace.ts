import { existsSync, promises as fs } from 'node:fs'
import { isMainThread } from 'node:worker_threads'
import { dirname, relative, resolve } from 'pathe'
import { mergeConfig } from 'vite'
import fg from 'fast-glob'
import c from 'tinyrainbow'
import type { UserWorkspaceConfig, WorkspaceProjectConfiguration } from '../../public/config'
import type { Vitest } from '../core'
import type { UserConfig } from '../types/config'
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

  try {
    // we have to resolve them one by one because CWD should depend on the project
    for (const filepath of [...configFiles, ...nonConfigDirectories]) {
      if (vitest.server.config.configFile === filepath) {
        const project = await vitest.createCoreProject()
        projects.push(project)
        continue
      }
      const dir = filepath.endsWith('/') ? filepath.slice(0, -1) : dirname(filepath)
      if (isMainThread) {
        process.chdir(dir)
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

  if (!projects.length && !projectPromises.length) {
    return [await vitest.createCoreProject()]
  }

  const resolvedProjects = await Promise.all([
    ...projects,
    ...projectPromises,
  ])
  const names = new Set<string>()

  for (const project of resolvedProjects) {
    const name = project.getName()
    if (names.has(name)) {
      const duplicate = resolvedProjects.find(p => p.getName() === name && p !== project)!
      throw new Error([
        `Project name "${name}"`,
        project.server.config.configFile ? ` from "${relative(vitest.config.root, project.server.config.configFile)}"` : '',
        ' is not unique.',
        duplicate?.server.config.configFile ? ` The project is already defined by "${relative(vitest.config.root, duplicate.server.config.configFile)}".` : '',
        ' All projects in a workspace should have unique names. Make sure your configuration is correct.',
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
  let nonConfigProjectDirectories: string[] = []

  const relativeWorkpaceConfigPath = relative(vitest.config.root, workspaceConfigPath)

  for (const definition of workspaceDefinition) {
    if (typeof definition === 'string') {
      const stringOption = definition.replace('<rootDir>', vitest.config.root)
      if (!stringOption.includes('*')) {
        const file = resolve(vitest.config.root, stringOption)

        if (!existsSync(file)) {
          throw new Error(`Workspace config file ${relativeWorkpaceConfigPath} references a non-existing file or a directory: ${file}`)
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
          throw new TypeError(`Unexpected file type: ${file}`)
        }
      }
      else {
        workspaceGlobMatches.push(stringOption)
      }
    }
    else if (typeof definition === 'function') {
      projectsOptions.push(await definition({
        command: vitest.server.config.command,
        mode: vitest.server.config.mode,
        isPreview: false,
        isSsrBuild: false,
      }))
    }
    else {
      projectsOptions.push(await definition)
    }

    if (workspaceGlobMatches.length) {
      const globOptions: fg.Options = {
        absolute: true,
        dot: true,
        onlyFiles: false,
        markDirectories: true,
        cwd: vitest.config.root,
        ignore: ['**/node_modules/**', '**/*.timestamp-*'],
      }

      const workspacesFs = await fg(workspaceGlobMatches, globOptions)

      await Promise.all(workspacesFs.map(async (filepath) => {
        // directories are allowed with a glob like `packages/*`
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
  }

  const projectConfigFiles = Array.from(new Set(workspaceConfigFiles))
  const duplicateDirectories = new Set()

  for (const config of projectConfigFiles) {
    // ignore custom config names because it won't be picked up by the default resolver later
    if (!defaultConfigFiles.includes(config)) {
      continue
    }

    const configDirectory = `${dirname(config)}/`
    // if for some reason there is already a config file in a directory that was found by a glob
    // we remove it from the list to avoid duplicates when the project is initialized
    for (const directory of nonConfigProjectDirectories) {
      if (directory === configDirectory) {
        vitest.logger.warn(
          c.yellow(
            `The specified config file "${resolve(vitest.config.root, config)}" is located in the directory already found by a glob match. `
            + `The config file will override the directory match to avoid duplicates. You can silence this message by excluding the directory from the glob in "${relativeWorkpaceConfigPath}".`,
          ),
        )
        duplicateDirectories.add(directory)
      }
    }
  }

  if (duplicateDirectories.size) {
    nonConfigProjectDirectories = nonConfigProjectDirectories.filter(dir => !duplicateDirectories.has(dir))
  }

  return {
    projectConfigs: projectsOptions,
    nonConfigDirectories: nonConfigProjectDirectories,
    configFiles: projectConfigFiles,
  }
}

async function resolveDirectoryConfig(directory: string) {
  const files = new Set(await fs.readdir(directory))
  const configFile = defaultConfigFiles.find(file => files.has(file))
  if (configFile) {
    return resolve(directory, configFile)
  }
  return null
}
