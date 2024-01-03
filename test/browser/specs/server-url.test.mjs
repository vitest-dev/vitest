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
  assert.match(result.stdout, /Browser runner started at http:\/\/localhost:5173\//)
  assert.match(result.stdout, /Test Files {2}1 passed/)
})

// the test is skipped since browser warns self-signed https and it requires manual interaction.
// you can toggle this "skip" to verify this test locally.
test('server-url https', { skip: true }, async () => {
  const result = await execa('npx', ['vitest', 'run', '--root=./fixtures/server-url'], {
    env: {
      NO_COLOR: '1',
      TEST_HTTPS: '1',
    },
  })

  assert.match(result.stdout, /Browser runner started at https:\/\/localhost:5173\//)
  assert.match(result.stdout, /Test Files {2}1 passed/)
})
