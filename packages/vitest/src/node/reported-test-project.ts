import type { ViteDevServer } from 'vite'
import type { ProvidedContext } from '../types/general'
import type { ResolvedConfig, ResolvedProjectConfig, SerializedConfig } from './types/config'
import type { WorkspaceProject } from './workspace'
import type { BrowserServer } from './types/browser'
import { getFilePoolName } from './pool'
import { VitestContext } from './context'
import type { TestSpecification } from './spec'

const kWorkspaceProject = Symbol('vitest.workspaceProject')

export class TestProject {
  /**
   * Resolved project configuration.
   */
  public readonly config: ResolvedProjectConfig
  /**
   * Resolved global configuration. If there are no workspace projects, this will be the same as `config`.
   */
  public readonly globalConfig: ResolvedConfig

  /**
   * The name of the project or an empty string if not set.
   */
  public readonly name: string

  /**
   * Context manager.
   */
  public readonly context: VitestContext

  public readonly vite: ViteDevServer

  /**
   * The workspace project this test project is associated with.
   * @experimental The public Vitest API is experimental and does not follow semver.
   */
  private readonly [kWorkspaceProject]: WorkspaceProject

  constructor(workspaceProject: WorkspaceProject) {
    this[kWorkspaceProject] = workspaceProject
    this.globalConfig = workspaceProject.ctx.config
    this.vite = workspaceProject.server
    this.config = workspaceProject.config
    this.name = workspaceProject.getName()
    this.context = new VitestContext(workspaceProject)
  }

  /**
   * Serialized project configuration. This is the config that tests receive.
   */
  public get serializedConfig(): SerializedConfig {
    return this[kWorkspaceProject].getSerializableConfig()
  }

  /**
   * Browser server if the project has browser enabled.
   */
  public get browser(): BrowserServer | null {
    return this[kWorkspaceProject].browser || null
  }

  /**
   * Create test specification describing a test module.
   * @param moduleId File path to the module or an ID that Vite understands (like a virtual module).
   * @param pool The pool to run the test in. If not provided, a pool will be selected based on the project configuration.
   */
  public createSpecification(moduleId: string, pool?: string): TestSpecification {
    return this[kWorkspaceProject].createSpec(
      moduleId,
      pool || getFilePoolName(this[kWorkspaceProject], moduleId),
    )
  }

  public workspaceProject = null

  /**
   * Serialize the project to JSON so it can be transferred between workers.
   */
  public toJSON(): SerializedTestProject {
    return {
      name: this.name,
      serializedConfig: this.serializedConfig,
      context: this[kWorkspaceProject].getProvidedContext(),
    }
  }
}

export function getWorkspaceProjectFromTestProject(project: TestProject): WorkspaceProject {
  return project[kWorkspaceProject]
}

interface SerializedTestProject {
  name: string
  serializedConfig: SerializedConfig
  context: ProvidedContext
}
