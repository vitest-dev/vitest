import type { DependencyRecord, ProjectDependencies } from './cache/dependencies'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import type { ModuleDependency, ModulesResolver } from './vcs/vcs'
import { getChangedFiles, getEnvFiles } from './affected-modules'
import { getRootRelativePath } from './cache/results'

/**
 * Finds test specifications that loaded any of the changed files during their last recorded run.
 * A specification without a record is always affected.
 */
export class RecordedModulesResolver implements ModulesResolver {
  private specsByProject = new Map<TestProject, TestSpecification[]>()

  constructor(
    private vitest: Vitest,
    private specs: TestSpecification[],
  ) {
    for (const spec of specs) {
      let projectSpecs = this.specsByProject.get(spec.project)
      if (!projectSpecs) {
        this.specsByProject.set(spec.project, (projectSpecs = []))
      }
      projectSpecs.push(spec)
    }
  }

  async getDependencies(): Promise<ModuleDependency[]> {
    await this.vitest.cache._dependencies.read()
    const root = this.vitest.config.root
    const recordedAt = new Map<string, number | undefined>()
    const add = (dependencies: ProjectDependencies, record: DependencyRecord) => {
      for (const index of record.deps) {
        const file = dependencies.modules[index]
        const previous = recordedAt.get(file)
        if (!recordedAt.has(file) || (previous !== undefined && record.at < previous)) {
          recordedAt.set(file, record.at)
        }
      }
    }
    for (const [project, specs] of this.specsByProject) {
      const dependencies = this.vitest.cache._dependencies.get(project)
      if (dependencies?.config) {
        add(dependencies, dependencies.config)
      }
      if (dependencies?.globalSetup) {
        add(dependencies, dependencies.globalSetup)
      }
      for (const spec of specs) {
        const record = dependencies?.files.get(getRootRelativePath(root, spec.moduleId))
        if (record && dependencies) {
          add(dependencies, record)
        } else if (!recordedAt.has(spec.moduleId)) {
          // a test file without a record has no known time, so it always runs
          recordedAt.set(spec.moduleId, undefined)
        }
      }
    }
    return Array.from(recordedAt, ([file, at]) => ({ file, recordedAt: at }))
  }

  async getAffectedSpecifications(related: string[]): Promise<Map<TestSpecification, Set<string>>> {
    const configChanges = getChangedFiles(this.vitest.vite.config.configFileDependencies, related)
    if (configChanges.length) {
      return affectAll(this.specs, configChanges)
    }
    await this.vitest.cache._dependencies.read()

    const affectedBy = new Map<TestSpecification, Set<string>>()
    for (const [project, projectSpecs] of this.specsByProject) {
      for (const [spec, files] of this.findAffectedInProject(project, projectSpecs, related)) {
        affectedBy.set(spec, files)
      }
    }
    return affectedBy
  }

  private findAffectedInProject(
    project: TestProject,
    specs: TestSpecification[],
    related: string[],
  ): Map<TestSpecification, Set<string>> {
    const configChanges = getChangedFiles(
      [...project.vite.config.configFileDependencies, ...getEnvFiles(project)],
      related,
    )
    if (configChanges.length) {
      return affectAll(specs, configChanges)
    }

    const dependencies = this.vitest.cache._dependencies.get(project)
    if (!dependencies) {
      return affectAll(specs, [])
    }

    const changed = new Set<number>()
    for (const file of related) {
      const index = dependencies.moduleIndex.get(file)
      if (index !== undefined) {
        changed.add(index)
      }
    }
    const getChanges = (record: DependencyRecord) =>
      new Set(
        record.deps
          .filter((index) => changed.has(index))
          .map((index) => dependencies.modules[index]),
      )
    if (project.config.globalSetup.length) {
      const globalSetup = dependencies.globalSetup
      if (!globalSetup) {
        return affectAll(specs, [])
      }
      const globalSetupChanges = getChanges(globalSetup)
      if (globalSetupChanges.size) {
        return affectAll(specs, globalSetupChanges)
      }
    }

    const root = this.vitest.config.root
    const affectedBy = new Map<TestSpecification, Set<string>>()
    for (const spec of specs) {
      const record = dependencies.files.get(getRootRelativePath(root, spec.moduleId))
      const changes = record ? getChanges(record) : new Set<string>()
      if (!record || changes.size) {
        affectedBy.set(spec, changes)
      }
    }
    return affectedBy
  }
}

function affectAll(
  specs: TestSpecification[],
  files: Iterable<string>,
): Map<TestSpecification, Set<string>> {
  return new Map(specs.map((spec) => [spec, new Set(files)]))
}
