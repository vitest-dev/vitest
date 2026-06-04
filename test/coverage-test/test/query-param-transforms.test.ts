import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, onTestFinished } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('query param based transforms are resolved properly', async () => {
  await runVitest({
    config: 'fixtures/configs/vitest.config.query-param-transform.ts',
    include: ['fixtures/test/query-param.test.ts'],
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()

  // Query params should not be present in final report
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/query-param-transformed.ts",
    ]
  `)

  const coverage = coverageMap.fileCoverageFor(coverageMap.files()[0])

  // Query params change which functions end up in transform result,
  // verify that all functions are present
  const functionCoverage = Object.keys(coverage.fnMap)
    .map(index => ({ name: coverage.fnMap[index].name, hits: coverage.f[index] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  expect(functionCoverage).toMatchInlineSnapshot(`
    [
      {
        "hits": 1,
        "name": "first",
      },
      {
        "hits": 3,
        "name": "initial",
      },
      {
        "hits": 1,
        "name": "second",
      },
      {
        "hits": 0,
        "name": "uncovered",
      },
    ]
  `)
})

test.each([{ changed: 'HEAD' }, { coverage: { changed: 'HEAD' } }])('query param transforms respect %s', async (options) => {
  const filePath = resolve('./fixtures/src/query-param-transformed.ts')
  const original = readFileSync(filePath, 'utf8')

  onTestFinished(() => writeFileSync(filePath, original, 'utf8'))
  writeFileSync(filePath, `${original}\nexport const changedMarker = true\n`, 'utf8')

  await runVitest({
    config: 'fixtures/configs/vitest.config.query-param-transform.ts',
    include: ['fixtures/test/query-param.test.ts'],
    ...options,
    coverage: { reporter: 'json', ...options.coverage },
  })

  const coverageMap = await readCoverageMap()

  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/query-param-transformed.ts",
    ]
  `)

  const coverage = coverageMap.fileCoverageFor(coverageMap.files()[0])

  const functionCoverage = Object.keys(coverage.fnMap)
    .map(index => ({ name: coverage.fnMap[index].name, hits: coverage.f[index] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  expect(functionCoverage).toMatchInlineSnapshot(`
    [
      {
        "hits": 1,
        "name": "first",
      },
      {
        "hits": 3,
        "name": "initial",
      },
      {
        "hits": 1,
        "name": "second",
      },
      {
        "hits": 0,
        "name": "uncovered",
      },
    ]
  `)
})
