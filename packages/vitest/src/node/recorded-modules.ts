import type { Vitest } from './core'
import type { TestProject } from './project'
import type { TestSpecification } from './test-specification'
import { getEnvFiles } from './affected-modules'
import { getRootRelativePath } from './cache/results'

/**
 * Finds test specifications that loaded any of the changed files during their last recorded run.
 * A specification without a record is always affected.
 */
export class RecordedModulesResolver {
  constructor(
    private vitest: Vitest,
    private related: string[],
  ) {}

  async resolve(specs: TestSpecification[]): Promise<TestSpecification[]> {
    if (this.dependsOnConfig(this.vitest.vite.config.configFileDependencies)) {
      return specs
    }
    await this.vitest.cache._dependencies.read()

    const specsByProject = new Map<TestProject, TestSpecification[]>()
    for (const spec of specs) {
      let projectSpecs = specsByProject.get(spec.project)
      if (!projectSpecs) {
        specsByProject.set(spec.project, (projectSpecs = []))
      }
      projectSpecs.push(spec)
    }

    const affected = new Set<TestSpecification>()
    for (const [project, projectSpecs] of specsByProject) {
      this.findAffectedInProject(project, projectSpecs).forEach((spec) => affected.add(spec))
    }
    return specs.filter((spec) => affected.has(spec))
  }

  private findAffectedInProject(
    project: TestProject,
    specs: TestSpecification[],
  ): TestSpecification[] {
    if (
      this.dependsOnConfig(project.vite.config.configFileDependencies) ||
      this.dependsOnConfig(getEnvFiles(project))
    ) {
      return specs
    }

    const dependencies = this.vitest.cache._dependencies.get(project)
    if (!dependencies) {
      return specs
    }

    const changed = new Set<number>()
    for (const file of this.related) {
      const index = dependencies.moduleIndex.get(file)
      if (index !== undefined) {
        changed.add(index)
      }
    }
    if (project.config.globalSetup.length) {
      const globalSetup = dependencies.globalSetup
      if (!globalSetup || globalSetup.some((index) => changed.has(index))) {
        return specs
      }
    }

    const root = this.vitest.config.root
    return specs.filter((spec) => {
      const loaded = dependencies.files.get(getRootRelativePath(root, spec.moduleId))
      return !loaded || loaded.some((index) => changed.has(index))
    })
  }

  private dependsOnConfig(configDependencies: string[] | undefined): boolean {
    return !!configDependencies?.some((file) => this.related.includes(file))
  }
}
