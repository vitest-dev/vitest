import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { afterAll, it } from 'vitest'
import { dirname, resolve } from 'pathe'
import { startWatchMode } from './utils'

const file = fileURLToPath(import.meta.url)
const dir = dirname(file)
const root = resolve(dir, '..', '..', 'workspaces')
const config = resolve(root, 'vitest.config.ts')

const srcMathFile = resolve(root, 'src', 'math.ts')
const specSpace2File = resolve(root, 'space_2', 'test', 'node.spec.ts')

const srcMathContent = readFileSync(srcMathFile, 'utf-8')
const specSpace2Content = readFileSync(specSpace2File, 'utf-8')

function startVitest() {
  return startWatchMode(
    { cwd: root, env: { TEST_WATCH: 'true' } },
    '--root',
    root,
    '--config',
    config,
    '--no-coverage',
  )
}

afterAll(() => {
  writeFileSync(srcMathFile, srcMathContent, 'utf8')
  writeFileSync(specSpace2File, specSpace2Content, 'utf8')
})

it('editing a test file in a suite with workspaces reruns test', async () => {
  const vitest = await startVitest()

  writeFileSync(specSpace2File, `${specSpace2Content}\n`, 'utf8')

  await vitest.waitForOutput('RERUN  space_2/test/node.spec.ts x1')
  await vitest.waitForOutput('|space_2| test/node.spec.ts')
  await vitest.waitForOutput('Test Files  1 passed')
})

it('editing a file that is imported in different workspaces reruns both files', async () => {
  const vitest = await startVitest()

  writeFileSync(srcMathFile, `${srcMathContent}\n`, 'utf8')

  await vitest.waitForOutput('RERUN  src/math.ts')
  await vitest.waitForOutput('|space_3| math.space-test.ts')
  await vitest.waitForOutput('|space_1| test/math.spec.ts')
  await vitest.waitForOutput('Test Files  2 passed')
})

it('filters by test name inside a workspace', async () => {
  const vitest = await startVitest()

  vitest.write('t')

  await vitest.waitForOutput('Input test name pattern')

  vitest.write('2 x 2 = 4\n')

  await vitest.waitForOutput('Test name pattern: /2 x 2 = 4/')
  await vitest.waitForOutput('Test Files  1 passed')
})
