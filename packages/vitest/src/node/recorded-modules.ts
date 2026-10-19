import type { DependencyRecord, ProjectDependencies } from './cache/dependencies'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import type { ModuleDependency, ModulesResolver } from './vcs/vcs'
import { getEnvFiles } from './affected-modules'
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

  async getAffectedSpecifications(related: string[]): Promise<TestSpecification[]> {
    if (dependsOnConfig(this.vitest.vite.config.configFileDependencies, related)) {
      return this.specs
    }
    await this.vitest.cache._dependencies.read()

    const affected = new Set<TestSpecification>()
    for (const [project, projectSpecs] of this.specsByProject) {
      this.findAffectedInProject(project, projectSpecs, related).forEach((spec) =>
        affected.add(spec),
      )
    }
    return this.specs.filter((spec) => affected.has(spec))
  }

  private findAffectedInProject(
    project: TestProject,
    specs: TestSpecification[],
    related: string[],
  ): TestSpecification[] {
    if (
      dependsOnConfig(project.vite.config.configFileDependencies, related) ||
      dependsOnConfig(getEnvFiles(project), related)
    ) {
      return specs
    }

    const dependencies = this.vitest.cache._dependencies.get(project)
    if (!dependencies) {
      return specs
    }

    const changed = new Set<number>()
    for (const file of related) {
      const index = dependencies.moduleIndex.get(file)
      if (index !== undefined) {
        changed.add(index)
      }
    }
    if (project.config.globalSetup.length) {
      const globalSetup = dependencies.globalSetup
      if (!globalSetup || globalSetup.deps.some((index) => changed.has(index))) {
        return specs
      }
    }

    const root = this.vitest.config.root
    return specs.filter((spec) => {
      const record = dependencies.files.get(getRootRelativePath(root, spec.moduleId))
      return !record || record.deps.some((index) => changed.has(index))
    })
  }
}

function dependsOnConfig(configDependencies: string[] | undefined, related: string[]): boolean {
  return !!configDependencies?.some((file) => related.includes(file))
}
