import assert from 'node:assert'
import test from 'node:test'
import { execa } from 'execa'

test('server-url http', async () => {
  const result = await execa('npx', ['vitest', 'run', '--root=./fixtures/server-url', '--browser.headless'], {
    env: {
      CI: '1',
      NO_COLOR: '1',
    },
  })
  assert.ok(result.stdout.includes('Browser runner started at http://localhost:5173/'))
  assert.ok(result.stdout.includes('Test Files  1 passed'))
})

// the test is skipped since browser warns self-signed https and it requires manual interaction.
// please comment out this "skip" to verify manually.
test('server-url https', { skip: true }, async () => {
  const result = await execa('npx', ['vitest', 'run', '--root=./fixtures/server-url'], {
    env: {
      NO_COLOR: '1',
      TEST_HTTPS: '1',
    },
  })
  assert.ok(result.stdout.includes('Browser runner started at https://localhost:5173/'))
  assert.ok(result.stdout.includes('Test Files  1 passed'))
})
