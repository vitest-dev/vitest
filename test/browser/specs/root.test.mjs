import assert from 'node:assert'
import test from 'node:test'
import { execa } from 'execa'

test('root1', async () => {
  const result = await execa('npx', [
    'vitest',
    'run',
    '--root=fixtures/root1',
    '--browser.headless',
    '--reporter=tap-flat',
  ])
  assert.match(result.stdout, /\n1\.\.1\nok 1/)
  assert.equal(result.stderr, '')
})

test('root2', async () => {
  const result = await execa('npx', [
    'vitest',
    'run',
    '--root=fixtures/root2',
    '--browser.headless',
    '--reporter=tap-flat',
  ])
  assert.match(result.stdout, /\n1\.\.1\nok 1/)
  assert.equal(result.stderr, '')
})

test('root3', async () => {
  const result = await execa('npx', [
    'vitest',
    'run',
    '--browser.headless',
    '--reporter=tap-flat',
  ], {
    reject: false
  })
  assert.match(result.stdout, /\n1\.\.29\n/)
})
