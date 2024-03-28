import fs from 'node:fs'
import { expect, it } from 'vitest'
import * as pathe from 'pathe'
import { runVitest } from '../../test-utils'

it('basic', { timeout: 60_000 }, async () => {
  const root = pathe.join(import.meta.dirname, '../fixtures/basic')
  const benchFile = pathe.join(root, 'bench.json')
  fs.rmSync(benchFile, { force: true })

  await runVitest({
    root,
    allowOnly: true,
    benchmark: {
      reporters: 'json',
      outputFile: 'bench.json',
    },
  }, [], 'benchmark')

  const benchResult = await fs.promises.readFile(benchFile, 'utf-8')
  const resultJson = JSON.parse(benchResult)

  expect(Object.keys(resultJson.testResults)).toEqual(
    expect.arrayContaining([
      'sort',
      'timeout',
      'a0',
      'c1',
      'a2',
      'b3',
      'b4',
    ]),
  )

  const skipped = ['skip', 's0', 's1', 's2', 's3', 'sb4', 's4', 'unimplemented suite', 'unimplemented test']
  for (const b of skipped)
    expect(benchResult).not.toContain(b)
})
