import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('domain snapshot matchers work in fixture suite', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain')
  const vitest = await runVitest({ root })
  expect(vitest.exitCode).toBe(0)
})

test.skip('domain inline snapshot updates second argument position', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-update')
  const testFile = join(root, 'basic.test.ts')

  editFile(testFile, content => content)

  const vitest = await runVitest({ root, update: true })
  expect(vitest.exitCode).toBe(0)

  const content = readFileSync(testFile, 'utf-8')
  expect(content).toMatch(/toMatchDomainInlineSnapshot\('test-domain-update', `value:hello 999`\)/)
})
