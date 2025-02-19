import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { afterAll, afterEach, expect, it } from 'vitest'

import { runVitestCli } from '../../test-utils'

const file = fileURLToPath(import.meta.url)
const dir = dirname(file)
const root = resolve(dir, '..', '..', 'workspaces')
const config = resolve(root, 'vitest.config.watch.ts')
const cleanups: (() => void)[] = []

const srcMathFile = resolve(root, 'src', 'math.ts')
const specSpace2File = resolve(root, 'space_2', 'test', 'node.spec.ts')

const srcMathContent = readFileSync(srcMathFile, 'utf-8')
const specSpace2Content = readFileSync(specSpace2File, 'utf-8')

const dynamicTestContent = `// Dynamic test added by test/watch/test/workspaces.test.ts
import { expect, test } from "vitest";

test("dynamic test case", () => {
  console.log("Running added dynamic test")
  expect(true).toBeTruthy()
})
`

async function startVitest() {
  const { vitest } = await runVitestCli(
    { nodeOptions: { cwd: root, env: { TEST_WATCH: 'true', NO_COLOR: 'true' } } },
    '--root',
    root,
    '--config',
    config,
    '--watch',
    '--no-coverage',
  )
  vitest.resetOutput()
  return vitest
}

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
})

afterAll(() => {
  writeFileSync(srcMathFile, srcMathContent, 'utf8')
  writeFileSync(specSpace2File, specSpace2Content, 'utf8')
})

it('editing a test file in a suite with workspaces reruns test', async () => {
  const vitest = await startVitest()

  writeFileSync(specSpace2File, `${specSpace2Content}\n`, 'utf8')

  await vitest.waitForStdout('RERUN  space_2/test/node.spec.ts x1')
  await vitest.waitForStdout('|space_2| test/node.spec.ts')
  await vitest.waitForStdout('Test Files  1 passed')
})

it('editing a file that is imported in different workspaces reruns both files', async () => {
  const vitest = await startVitest()

  writeFileSync(srcMathFile, `${srcMathContent}\n`, 'utf8')

  await vitest.waitForStdout('RERUN  src/math.ts')
  await vitest.waitForStdout('|@vitest/space_3| math.space-3-test.ts')
  await vitest.waitForStdout('|space_1| test/math.spec.ts')
  await vitest.waitForStdout('Test Files  2 passed')
})

it('filters by test name inside a workspace', async () => {
  const vitest = await startVitest()

  vitest.write('t')

  await vitest.waitForStdout('Input test name pattern')

  vitest.write('2 x 2 = 4\n')

  await vitest.waitForStdout('Test name pattern: /2 x 2 = 4/')
  await vitest.waitForStdout('Test Files  1 passed')
})

it('adding a new test file matching core project config triggers re-run', async () => {
  const vitest = await startVitest()

  const testFile = resolve(root, 'space_2', 'test', 'new-dynamic.test.ts')

  cleanups.push(() => rmSync(testFile))
  writeFileSync(testFile, dynamicTestContent, 'utf-8')

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  space_2/test/new-dynamic.test.ts')
  await vitest.waitForStdout('|space_2| test/new-dynamic.test.ts')

  // Wait for tests to end
  await vitest.waitForStdout('Waiting for file changes')

  // Test case should not be run by other projects
  expect(vitest.stdout).not.include('|space_1|')
  expect(vitest.stdout).not.include('|@vitest/space_3|')
  expect(vitest.stdout).not.include('|node|')
  expect(vitest.stdout).not.include('|happy-dom|')
})

it('adding a new test file matching project specific config triggers re-run', async () => {
  const vitest = await startVitest()

  const testFile = resolve(root, 'space_3', 'new-dynamic.space-3-test.ts')
  cleanups.push(() => rmSync(testFile))
  writeFileSync(testFile, dynamicTestContent, 'utf-8')

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  space_3/new-dynamic.space-3-test.ts')
  await vitest.waitForStdout('|@vitest/space_3| new-dynamic.space-3-test.ts')

  // Wait for tests to end
  await vitest.waitForStdout('Waiting for file changes')

  // Test case should not be run by other projects
  expect(vitest.stdout).not.include('|space_1|')
  expect(vitest.stdout).not.include('|space_2|')
  expect(vitest.stdout).not.include('|node|')
  expect(vitest.stdout).not.include('|happy-dom|')
})
