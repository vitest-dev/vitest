import { test } from 'vitest'
import { runVitest } from '../../test-utils'

test('test run is not started when --standalone', async () => {
  const { vitest } = await runVitest({
    root: 'fixtures/standalone',
    standalone: true,
    watch: true,
  })

  await vitest.waitForStdout('Vitest is running in standalone mode. Edit a test file to rerun tests.')
  await vitest.waitForStdout('PASS  Waiting for file changes...')
  await vitest.waitForStdout('press h to show help, press q to quit')
})

test('test run is started when --standalone and filename filter', async () => {
  const { vitest } = await runVitest({
    root: 'fixtures/standalone',
    standalone: true,
    watch: true,
  }, ['basic.test.ts'])

  await vitest.waitForStdout('✓ basic.test.ts > example')
  await vitest.waitForStdout('Test Files  1 passed (1)')
  await vitest.waitForStdout('Tests  1 passed (1)')

  await vitest.waitForStdout('PASS  Waiting for file changes...')
  await vitest.waitForStdout('press h to show help, press q to quit')
})
