import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('temporary files are removed after test', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: { reporter: 'json' },
  })

  const coveragePath = resolve('./coverage')
  const files = readdirSync(coveragePath)

  expect(files).not.toContain('.tmp')

  expect(files).toMatchInlineSnapshot(`
    [
      "coverage-final.json",
    ]
  `)
})
