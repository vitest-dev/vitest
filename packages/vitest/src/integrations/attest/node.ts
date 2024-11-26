import type { TestProject } from '../../node/project'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

async function setup() {
  // TODO: programatic API
  mkdirSync('.attest/assertions', { recursive: true })
  execFileSync('attest', ['precache', '.attest/assertions/typescript.json'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ATTEST_attestAliases: JSON.stringify(['expect']),
    },
  })
}

export async function globalSetupAttest(project: TestProject) {
  // TODO: vitest level config
  // TODO: workspace support?
  if (!process.env.VITEST_ATTEST) {
    return
  }

  await setup()
  project.onTestsRerun(() => setup())
}
