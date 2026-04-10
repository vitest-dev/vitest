import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { normalize, resolve } from 'pathe'
import { assert, expect, onTestFinished, test } from 'vitest'
import { runVitest } from '../../../test-utils'

test('creates .vitest when initialized', async () => {
  const vitest = await run()
  const directory = resolve(vitest.config.root, '.vitest')

  rmSync(directory, { recursive: true, force: true })
  vitest.createResultWriter('example-reporter')

  expect(existsSync(directory)).toBe(true)
})

test('sets base', async () => {
  const vitest = await run()

  const resultWriter = vitest.createResultWriter('example-reporter')

  expect(normalize(resultWriter.base)).toBe(
    resolve(vitest.config.root, '.vitest', 'example-reporter'),
  )
})

test('write creates file in scoped directory', async () => {
  const vitest = await run()

  const resultWriter = vitest.createResultWriter('example-reporter')
  await resultWriter.write('example-result.txt', 'Example results here!')

  expect(readFileSync(resolve(vitest.config.root, '.vitest', 'example-reporter', 'example-result.txt'), 'utf-8')).toBe('Example results here!')
})

test('reads file in scoped directory', async () => {
  const vitest = await run()

  const resultWriter = vitest.createResultWriter('example-reporter')
  writeFileSync(resolve(vitest.config.root, '.vitest', 'example-reporter', 'example-result.txt'), 'Example results here!')

  await expect(resultWriter.read('example-result.txt')).resolves.toBe('Example results here!')
})

test('delete() removes file in scoped directory', async () => {
  const vitest = await run()

  const resultWriter = vitest.createResultWriter('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'results-1'), 'anything')
  writeFileSync(resolve(scopedDir, 'results-2'), 'anything')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "results-1",
      "results-2",
    ]
  `)

  await resultWriter.delete('results-1')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "results-2",
    ]
  `)
})

test('clean() clears only the scoped directory', async () => {
  const vitest = await run()

  // This directory should not be affected by scoped result writer
  const unrelatedDir = resolve(vitest.config.root, '.vitest', 'unrelated-reporter')
  mkdirSync(unrelatedDir, { recursive: true })
  writeFileSync(resolve(unrelatedDir, 'results-1'), 'anything')

  const resultWriter = vitest.createResultWriter('example-reporter')
  const scopedDir = resolve(vitest.config.root, '.vitest', 'example-reporter')
  mkdirSync(scopedDir, { recursive: true })
  writeFileSync(resolve(scopedDir, 'results-2'), 'anything')
  writeFileSync(resolve(scopedDir, 'results-3'), 'anything')

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`
    [
      "results-2",
      "results-3",
    ]
  `)
  expect(readdirSync(unrelatedDir)).toMatchInlineSnapshot(`
    [
      "results-1",
    ]
  `)

  await resultWriter.clean()

  expect(readdirSync(scopedDir)).toMatchInlineSnapshot(`[]`)
  expect(readdirSync(unrelatedDir)).toMatchInlineSnapshot(`
    [
      "results-1",
    ]
  `)
})

async function run() {
  const vitest = await runVitest({
    root: './fixtures/basic',
    standalone: true,
    watch: true,
  })

  assert(vitest.ctx)
  const root = vitest.ctx.config.root

  onTestFinished(() => {
    rmSync(resolve(root, '.vitest'), { recursive: true, force: true })
  })

  return vitest.ctx
}
