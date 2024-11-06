import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest, useFS } from '../../test-utils'

const ts = String.raw

test('reruns tests when configs change', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/config-watching')
  const { editFile } = useFS(root, {
    './vitest.workspace.ts': [
      './project-1',
      './project-2',
    ],
    './vitest.config.ts': {},
    './project-1/vitest.config.ts': {},
    './project-1/basic.test.ts': ts`
      import { test } from 'vitest'
      test('basic test 1', () => {})
    `,
    './project-2/vitest.config.ts': {},
    './project-2/basic.test.ts': ts`
      import { test } from 'vitest'
      test('basic test 2', () => {})
    `,
  })

  const { vitest } = await runVitest({
    root,
    watch: true,
  })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  // editing the project config should trigger a restart
  editFile('./project-1/vitest.config.ts', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  // editing the root config should trigger a restart
  editFile('./vitest.config.ts', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  // editing the workspace config should trigger a restart
  editFile('./vitest.workspace.ts', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')
})

test('rerun stops the previous browser server and restarts multiple times without port mismatch', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-config-watching')
  const { editFile } = useFS(root, {
    './vitest.workspace.ts': [
      './project-1',
    ],
    './vitest.config.ts': {},
    './project-1/vitest.config.ts': {
      test: {
        browser: {
          enabled: true,
          name: 'chromium',
          provider: 'playwright',
          headless: true,
        },
      },
    },
    './project-1/basic.test.ts': ts`
      import { test } from 'vitest'
      test('basic test 1', () => {})
    `,
  })

  const { vitest } = await runVitest({
    root,
    watch: true,
  })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  // editing the project config the first time restarts the browser server
  editFile('./project-1/vitest.config.ts', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).not.toContain('is in use, trying another one...')
  expect(vitest.stderr).not.toContain('is in use, trying another one...')
  vitest.resetOutput()

  // editing the project the second time also restarts the server
  editFile('./project-1/vitest.config.ts', c => `\n${c}`)

  await vitest.waitForStdout('Restarting due to config changes...')
  await vitest.waitForStdout('Waiting for file changes')

  expect(vitest.stdout).not.toContain('is in use, trying another one...')
  expect(vitest.stderr).not.toContain('is in use, trying another one...')
  vitest.resetOutput()
})
