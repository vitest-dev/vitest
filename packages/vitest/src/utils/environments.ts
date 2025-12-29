import type { DevEnvironment } from 'vite'
import type { TestProject } from '../node/project'

export function getTestFileEnvironment(project: TestProject, testFile: string, browser = false): DevEnvironment | undefined {
  if (browser) {
    return project.browser?.vite.environments.client
  }
  else {
    for (const name in project.vite.environments) {
      const env = project.vite.environments[name]
      if (env.moduleGraph.getModuleById(testFile)) {
        return env
      }
    }
  }
}
