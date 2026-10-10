import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { TestSpecification } from '../test-specification'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { cleanUrl } from '@vitest/utils/helpers'
import { dirname, isAbsolute, resolve } from 'pathe'
import { createDebugger } from '../../utils/debugger'
import { getEnvFiles } from '../affected-modules'
import { tagCacheDir } from './cachedirTag'
import { atomicWriteFile } from './fsModuleCache'
import { getFileStamp, getRootRelativePath, isPartialRun } from './results'

const debug = createDebugger('vitest:cache:dependencies')

const DEPENDENCIES_VERSION = 2

export interface DependencyRecord {
  /** Start time of the run that recorded the dependencies. */
  at: number
  /** Indices into `modules`. */
  deps: number[]
}

export interface ProjectDependencies {
  /** Absolute paths without a query, referenced by index. */
  modules: string[]
  moduleIndex: Map<string, number>
  /** The config file, its imports and the `.env` files. */
  config?: DependencyRecord
  globalSetup?: DependencyRecord
  /** Keyed by the root-relative test file path. */
  files: Map<string, DependencyRecord>
}

interface SerializedDependencies {
  version: number
  projects: Record<
    string,
    {
      modules: string[]
      config?: DependencyRecord
      globalSetup?: DependencyRecord
      files: Record<string, DependencyRecord>
    }
  >
}

/**
 * Stores the modules that every test file loaded during its last run.
 */
export class DependenciesCache {
  private projects = new Map<string, ProjectDependencies>()
  // recorded during the current run, merged into `projects` by `update`
  private recordedFiles = new Map<string, Map<string, string[]>>()
  private recordedGlobalSetup = new Map<string, string[]>()
  private path: string | null
  private fileStamp: string | undefined

  constructor(private vitest: Vitest) {
    this.path =
      vitest.config.cache && vitest.config.experimental.recordDependencies
        ? resolve(vitest.viteConfig.cacheDir, 'dependencies.json')
        : null
  }

  get(project: TestProject): ProjectDependencies | undefined {
    return this.projects.get(project.name)
  }

  record(project: TestProject, filepath: string, dependencies: string[]): void {
    if (!this.path) {
      return
    }
    let files = this.recordedFiles.get(project.name)
    if (!files) {
      this.recordedFiles.set(project.name, (files = new Map()))
    }
    files.set(filepath, this.resolveFiles(project, dependencies))
  }

  recordGlobalSetup(project: TestProject, dependencies: string[]): void {
    if (this.path && dependencies.length) {
      this.recordedGlobalSetup.set(project.name, this.resolveFiles(project, dependencies))
    }
  }

  async read(): Promise<void> {
    const path = this.path
    const stamp = path ? await getFileStamp(path) : undefined
    if (!path || !stamp || stamp === this.fileStamp) {
      return
    }
    this.fileStamp = stamp
    try {
      const { version, projects }: SerializedDependencies = JSON.parse(
        await readFile(path, 'utf-8'),
      )
      if (version !== DEPENDENCIES_VERSION) {
        debug?.(`ignored ${path}, the version ${version} is not supported`)
        return
      }
      const root = this.vitest.config.root
      const result = new Map<string, ProjectDependencies>()
      for (const name in projects) {
        const { modules, config, globalSetup, files } = projects[name]
        const absoluteModules = modules.map((file) => resolve(root, file))
        result.set(name, {
          modules: absoluteModules,
          moduleIndex: new Map(absoluteModules.map((file, index) => [file, index])),
          config,
          globalSetup,
          files: new Map(Object.entries(files)),
        })
      }
      this.projects = result
    } catch (error) {
      debug?.(`failed to read ${path}: ${error}`)
    }
  }

  async update(specifications: TestSpecification[], startTime: number): Promise<void> {
    if (!this.recordedFiles.size && !this.recordedGlobalSetup.size) {
      return
    }
    await this.read()

    const projects = new Set(specifications.map((spec) => spec.project))
    projects.add(this.vitest.getRootProject())
    for (const project of projects) {
      const dependencies = this.getProjectDependencies(project.name)
      dependencies.config = {
        at: startTime,
        deps: this.intern(dependencies, getConfigFiles(project)),
      }
    }

    for (const [name, files] of this.recordedGlobalSetup) {
      const project = this.getProjectDependencies(name)
      project.globalSetup = { at: startTime, deps: this.intern(project, files) }
    }

    for (const specification of specifications) {
      const files = this.recordedFiles.get(specification.project.name)?.get(specification.moduleId)
      const task = specification.testModule?.task
      if (!files || !task) {
        continue
      }
      const project = this.getProjectDependencies(specification.project.name)
      const file = getRootRelativePath(this.vitest.config.root, specification.moduleId)
      const previous = project.files.get(file)
      // a partial run skips tests, so it can miss their dynamic imports,
      // without a previous record the file keeps having none and always runs
      if (!isPartialRun(this.vitest, specification, task)) {
        project.files.set(file, { at: startTime, deps: this.intern(project, files) })
      } else if (previous) {
        project.files.set(file, {
          at: previous.at,
          deps: Array.from(new Set([...previous.deps, ...this.intern(project, files)])),
        })
      }
    }

    this.recordedFiles.clear()
    this.recordedGlobalSetup.clear()
    await this.write()
  }

  async clear(): Promise<void> {
    this.projects.clear()
    this.fileStamp = undefined
    if (this.path && existsSync(this.path)) {
      await rm(this.path, { force: true })
      this.vitest.logger.log('[cache] cleared dependencies cache at', this.path)
    }
  }

  // the files of the modules, with the files that plugins watch for them
  private resolveFiles(project: TestProject, dependencies: string[]): string[] {
    const files = new Set<string>()
    const add = (file: string) => {
      if (isAbsolute(file) && !file.includes('node_modules')) {
        files.add(file)
      }
    }
    // without the module runner, plugins do not transform the modules and cannot watch files
    const watchedByPlugins = project.config.experimental.viteModuleRunner !== false
    for (const id of dependencies) {
      add(cleanUrl(id))
      if (!watchedByPlugins) {
        continue
      }
      for (const environment of Object.values(project.vite.environments)) {
        const node = environment.moduleGraph.getModuleById(id)
        const transformed = node?.transformResult
        if (!transformed) {
          continue
        }
        const imports = new Set([...(transformed.deps || []), ...(transformed.dynamicDeps || [])])
        node.importedModules.forEach((imported) => {
          if (imported.file && !imports.has(imported.url)) {
            add(imported.file)
          }
        })
        break
      }
    }
    return Array.from(files)
  }

  private intern(project: ProjectDependencies, files: string[]): number[] {
    return files.map((file) => {
      let index = project.moduleIndex.get(file)
      if (index === undefined) {
        index = project.modules.push(file) - 1
        project.moduleIndex.set(file, index)
      }
      return index
    })
  }

  private getProjectDependencies(name: string): ProjectDependencies {
    let project = this.projects.get(name)
    if (!project) {
      project = { modules: [], moduleIndex: new Map(), files: new Map() }
      this.projects.set(name, project)
    }
    return project
  }

  private async write(): Promise<void> {
    if (!this.path) {
      return
    }
    const root = this.vitest.config.root
    const projects: SerializedDependencies['projects'] = Object.create(null)
    for (const [name, { modules, config, globalSetup, files }] of this.projects) {
      projects[name] = {
        modules: modules.map((file) => getRootRelativePath(root, file)),
        config,
        globalSetup,
        files: Object.fromEntries(files),
      }
    }
    const dependencies: SerializedDependencies = { version: DEPENDENCIES_VERSION, projects }
    try {
      const cacheDir = dirname(this.path)
      await mkdir(cacheDir, { recursive: true })
      tagCacheDir(dirname(cacheDir))
      await atomicWriteFile(this.path, JSON.stringify(dependencies))
      this.fileStamp = await getFileStamp(this.path)
    } catch (error) {
      debug?.(`failed to write ${this.path}: ${error}`)
    }
  }
}

// the files that run every test when they change, only the ones that exist
function getConfigFiles(project: TestProject): string[] {
  const files = new Set([
    ...(project.vitest.vite.config.configFileDependencies || []),
    ...(project.vite.config.configFileDependencies || []),
    ...getEnvFiles(project),
  ])
  return Array.from(files).filter((file) => existsSync(file))
}
