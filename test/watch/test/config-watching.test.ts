import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const ts = String.raw

test('rerun stops the previous browser server and restarts multiple times without port mismatch', async () => {
  const { fs, vitest } = await runInlineTests({
    'vitest.config.js': {
      test: {
        projects: ['./project-1'],
      },
    },
    'project-1/vitest.config.js': {
      test: {
        browser: {
          enabled: true,
          instances: [{ browser: 'chromium' }],
          provider: 'playwright',
          headless: true,
        },
      },
    },
    'project-1/basic.test.ts': ts`
      import { test } from 'vitest'
      test('basic test 1', () => {})
    `,
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  // editing the project config the first time restarts the browser server
  fs.editFile('./project-1/vitest.config.js', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).not.toContain('is in use, trying another one...')
  expect(vitest.stderr).not.toContain('is in use, trying another one...')
  vitest.resetOutput()

  // editing the project the second time also restarts the server
  fs.editFile('./project-1/vitest.config.js', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).not.toContain('is in use, trying another one...')
  expect(vitest.stderr).not.toContain('is in use, trying another one...')
  vitest.resetOutput()
})
