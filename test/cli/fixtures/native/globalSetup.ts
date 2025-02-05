import type { TestProject } from 'vitest/node'

export default (project: TestProject) => {
  project.vitest.logger.log('global setup')
  return () => {
  project.vitest.logger.log('global teardown')
  }
}
