import { beforeAll, expect, it } from 'vitest'
import { resolve } from 'pathe'
import type { File } from 'vitest'
import type { StateManager } from 'vitest/src/node/state.js'
import type { WorkspaceProject } from 'vitest/node'
import { runVitest } from '../../test-utils'
import type { TestFile } from '../../../packages/vitest/src/node/reporters/reported-tasks'

// const finishedFiles: File[] = []
const collectedFiles: File[] = []
let state: StateManager
let project: WorkspaceProject

beforeAll(async () => {
  const { ctx } = await runVitest({
    root: resolve(__dirname, '..', 'fixtures', 'reported-tasks'),
    include: ['**/*.test.ts'],
    reporters: [
      'verbose',
      {
        // onFinished(files) {
        //   finishedFiles.push(...files || [])
        // },
        onCollected(files) {
          collectedFiles.push(...files || [])
        },
      },
    ],
    includeTaskLocation: true,
  })
  state = ctx!.state
  project = ctx!.getCoreWorkspaceProject()
})

it('correctly reports a file', async () => {
  const files = state.getFiles() || []
  expect(files).toHaveLength(1)

  const testFile = state._experimental_getReportedEntity(files[0])! as TestFile
  expect(testFile).toBeDefined()
  // suite properties not available on file
  expect(testFile).not.toHaveProperty('parent')
  expect(testFile).not.toHaveProperty('options')
  expect(testFile).not.toHaveProperty('file')

  expect(testFile.task).toBe(files[0])
  expect(testFile.fullName).toBe('1_first.test.ts')
  expect(testFile.name).toBe('1_first.test.ts')
  expect(testFile.id).toBe(files[0].id)
  expect(testFile.location).toBeUndefined()
  expect(testFile.moduleId).toBe(resolve('./fixtures/reported-tasks/1_first.test.ts'))
  expect(testFile.project).toBe(project)
  expect(testFile.children.size).toBe(14)

  const tests = [...testFile.children.tests()]
  expect(tests).toHaveLength(11)
  const deepTests = [...testFile.children.deepTests()]
  expect(deepTests).toHaveLength(19)

  const suites = [...testFile.children.suites()]
  expect(suites).toHaveLength(3)
  const deepSuites = [...testFile.children.deepSuites()]
  expect(deepSuites).toHaveLength(4)

  const diagnostic = testFile.diagnostic()
  expect(diagnostic).toBeDefined()
  expect(diagnostic.environmentSetupDuration).toBeGreaterThan(0)
  expect(diagnostic.prepareDuration).toBeGreaterThan(0)
  expect(diagnostic.collectDuration).toBeGreaterThan(0)
  expect(diagnostic.duration).toBeGreaterThan(0)
  // doesn't have a setup file
  expect(diagnostic.setupDuration).toBe(0)
})
