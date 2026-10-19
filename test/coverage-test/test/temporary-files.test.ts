import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { isBrowser, isV8Provider, runVitest, test } from '../utils'

test('temporary files are removed after test', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: { reporter: 'json' },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect.soft(files).not.toContain('.tmp')

  expect.soft(files).toMatchInlineSnapshot(`
    [
      "coverage-final.json",
    ]
  `)
})

test('temporary files from autoAttachSubprocess are removed after test', async ({ skip }) => {
  skip(!isV8Provider() || isBrowser(), 'V8 + node only feature')

  await runVitest({
    include: ['fixtures/test/child-process.test.ts'],
    pool: 'forks',
    coverage: { reporter: 'json', autoAttachSubprocess: true },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect.soft(files).not.toContain('.tmp')
  expect.soft(files).not.toContain('tmp')

  expect.soft(files).toMatchInlineSnapshot(`
    [
      "coverage-final.json",
    ]
  `)
})
