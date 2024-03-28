import fs from 'node:fs'
import { expect, it } from 'vitest'
import * as pathe from 'pathe'
import { runVitest } from '../../test-utils'

it('sequential', async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/sequential')
  await runVitest({ root }, [], 'benchmark')
  const testLog = await fs.promises.readFile(pathe.join(root, 'test.log'), 'utf-8')
  expect(testLog).toMatchSnapshot()
})
