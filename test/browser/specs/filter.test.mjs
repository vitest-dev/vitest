import assert from 'node:assert'
import test from 'node:test'
import { execa } from 'execa'

test('filter', async () => {
  let result = execa(
    'npx',
    [
      'vitest',
      'run',
      'test/basic.test.ts',
      '--testNamePattern',
      'basic 2',
      '--browser.headless',
      '--reporter=verbose',
    ],
    {
      env: {
        CI: '1',
        NO_COLOR: '1',
      },
    },
  )
  if (process.env.VITEST_BROWSER_DEBUG) {
    result.stderr.on('data', (data) => {
      process.stderr.write(data.toString())
    })
    result.stdout.on('data', (data) => {
      process.stdout.write(data.toString())
    })
  }
  result = await result
  assert.match(result.stdout, /✓ test\/basic.test.ts > basic 2/)
  assert.match(result.stdout, /Test Files {2}1 passed/)
  assert.match(result.stdout, /Tests {2}1 passed | 3 skipped/)
})
