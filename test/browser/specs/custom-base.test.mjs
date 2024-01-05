import assert from 'node:assert'
import test from 'node:test'
import { execa } from 'execa'

test('custom-base', { skip: true }, async () => {
  const result = await execa('npx', [
    'vitest',
    'run',
    '--root=fixtures/custom-base',
    '--browser.headless',
    '--reporter=tap-flat',
  ])
  assert.match(result.stdout, /\n1\.\.1\nok 1/)
  assert.equal(result.stderr, '')
})
