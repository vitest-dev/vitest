import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { normalize, resolve } from 'pathe'
import { assert, expect, onTestFinished, test } from 'vitest'
import { runVitest } from '../../../test-utils'

test('creates .vitest when initialized', async () => {
  const vitest = await run()
  const directory = resolve(vitest.config.root, '.vitest')

  rmSync(directory, { recursive: true, force: true })
  vitest.createReport('example-reporter')

  expect(existsSync(directory)).toBe(true)
})

test('sets root', async () => {
  const vitest = await run()

  const report = vitest.createReport('example-reporter')

  expect(normalize(report.root)).toBe(
    resolve(vitest.config.root, '.vitest', 'example-reporter'),
  )
})

test('writeFile() creates file in scoped directory', async () => {
  const vitest = await run()

  const report = vitest.createReport('example-reporter')
  await report.writeFile('example-report.txt', 'Example report here!')

  expect(readFileSync(resolve(vitest.config.root, '.vitest', 'example-reporter', 'example-report.txt'), 'utf-8')).toBe('Example report here!')
})

test('readFile() reads a file in scoped directory', async () => {
  const vitest = await run()

  const report = vitest.createReport('example-reporter')
  writeFileSync(resolve(vitest.config.root, '.vitest', 'example-reporter', 'example-report.txt'), 'Example report here!')

  await expect(report.readFile('example-report.txt')).resolves.toBe('Example report here!')
})

test('readdir() reads contents of scoped directory', async () => {
  const vitest = await run()

  const report = vitest.createReport('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'report-1'), 'anything')
  writeFileSync(resolve(scopedDir, 'report-2'), 'anything')

  await expect(report.readdir()).resolves.toMatchInlineSnapshot(`
    [
      "report-1",
      "report-2",
    ]
  `)
})

test('delete() removes file in scoped directory', async () => {
  const vitest = await run()

  const report = vitest.createReport('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'report-1'), 'anything')
  writeFileSync(resolve(scopedDir, 'report-2'), 'anything')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "report-1",
      "report-2",
    ]
  `)

  await report.delete('report-1')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "report-2",
    ]
  `)
})

test('clean() clears only the scoped directory', async () => {
  const vitest = await run()

  // This directory should not be affected by scoped report writer
  const unrelatedDir = resolve(vitest.config.root, '.vitest', 'unrelated-reporter')
  mkdirSync(unrelatedDir, { recursive: true })
  writeFileSync(resolve(unrelatedDir, 'report-1'), 'anything')

  const report = vitest.createReport('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'report-2'), 'anything')
  writeFileSync(resolve(scopedDir, 'report-3'), 'anything')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "report-2",
      "report-3",
    ]
  `)
  expect(readdirSync(unrelatedDir)).toMatchInlineSnapshot(`
    [
      "report-1",
    ]
  `)

  await report.clean()

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`[]`)
  expect(readdirSync(unrelatedDir)).toMatchInlineSnapshot(`
    [
      "report-1",
    ]
  `)
})

test('clean() does not clear results when --merge-reports is used, unless forced to', async () => {
  const vitest = await run({ mergeReports: '.vitest/blob', watch: false, standalone: false })

  const report = vitest.createReport('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'report-1'), 'anything')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "report-1",
    ]
  `)

  await report.clean()

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "report-1",
    ]
  `)

  await report.clean(true)

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`[]`)
})

async function run(options?: Partial<Parameters<typeof runVitest>[0]>) {
  const vitest = await runVitest({
    root: './fixtures/basic',
    standalone: true,
    watch: true,
    ...options,
  })

  assert(vitest.ctx)
  const root = vitest.ctx.config.root

  onTestFinished(() => {
    rmSync(resolve(root, '.vitest'), { recursive: true, force: true })
  })

  return vitest.ctx
}
