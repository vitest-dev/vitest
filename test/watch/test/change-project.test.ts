import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('reruns tests when config changes', async () => {
  const { vitest, ctx } = await runInlineTests({
    'vitest.config.ts': `

    process.stdin.isTTY = true
    process.stdin.setRawMode = () => process.stdin

    export default {
      test: {
        workspace: [
          './project-1',
          './project-2',
        ],
      },
    }`,
    'project-1/vitest.config.ts': { test: { name: 'project-1' } },
    'project-1/basic-1.test.ts': /* ts */`
      import { test } from 'vitest'
      test('basic test 1', () => {})
    `,
    'project-2/vitest.config.ts': { test: { name: 'project-2' } },
    'project-2/basic-2.test.ts': /* ts */`
      import { test } from 'vitest'
      test('basic test 2', () => {})
    `,
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).toContain('2 passed')
  expect(vitest.stdout).toContain('basic-1.test.ts')
  expect(vitest.stdout).toContain('basic-2.test.ts')
  vitest.resetOutput()

  await ctx!.changeProjectName('project-2')

  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).toContain('1 passed')
  expect(vitest.stdout).toContain('basic-2.test.ts')
})
