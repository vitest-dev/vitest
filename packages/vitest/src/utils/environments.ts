import type { DevEnvironment } from 'vite'
import type { TestProject } from '../node/project'

export function getTestFileEnvironment(project: TestProject, testFile: string, browser = false): DevEnvironment | undefined {
  let environment: DevEnvironment | undefined
  if (browser) {
    environment = project.browser?.vite.environments.client
  }
  else {
    for (const name in project.vite.environments) {
      const env = project.vite.environments[name]
      if (env.moduleGraph.getModuleById(testFile)) {
        environment = env
        break
      }
    }
  }

  return environment
}
