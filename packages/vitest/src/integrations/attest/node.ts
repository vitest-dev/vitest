import type { TestProject } from '../../node/project'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export async function attestGlobalSetup(project: TestProject) {
  process.env.ATTEST_attestAliases = JSON.stringify(['attest', 'expect'])

  const { writeAssertionData } = await import('@ark/attest')
  const filepath = path.join(project.config.root, '.attest/assertions/typescript.json')
  mkdirSync(path.dirname(filepath), { recursive: true })

  function precache(): void {
    return writeAssertionData(filepath)
  }

  precache()
  project.onTestsRerun(() => precache())
}
