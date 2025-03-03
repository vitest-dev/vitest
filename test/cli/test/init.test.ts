import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const ARROW_DOWN = '\u001B[B'
const ENTER = '\n'

const cwd = 'fixtures/browser-init'

beforeEach(async () => {
  await cleanup()
  return cleanup

  async function cleanup() {
    for (const file of await getFiles()) {
      if (file !== 'package.json') {
        await rm(`${cwd}/${file}`, { recursive: true })
      }
    }
    await writeFile(`${cwd}/vitest.config.ts`, '{}', 'utf8')
  }
})

test('initializes project', async () => {
  const { vitest } = await runVitestCli({ nodeOptions: { cwd } }, 'init', 'browser')

  await vitest.waitForStdout('This utility will help you set up a browser testing environment.')
  await vitest.waitForStdout('? Choose a language for your tests')
  vitest.write(ENTER)

  await vitest.waitForStdout('Choose a browser provider')
  vitest.write(`${ARROW_DOWN}${ARROW_DOWN}${ENTER}`)

  await vitest.waitForStdout('Choose a browser')
  vitest.write(ENTER)

  await vitest.waitForStdout('Choose your framework')
  vitest.write(ENTER)

  await vitest.waitForStdout('✔ All packages are already installed.')
  await vitest.waitForStdout('✔ Added "test:browser" script to your package.json.')
  await vitest.waitForStdout(`✔ Created example test file in ${join('vitest-example', 'HelloWorld.test.ts')}`)
  await vitest.waitForStdout('All done! Run your tests with pnpm test:browser')

  expect(await getFiles()).toMatchInlineSnapshot(`
    [
      "package.json",
      "vitest-example",
      "vitest.config.ts",
      "vitest.workspace.ts",
    ]
  `)

  expect(await getFileContent('/vitest.workspace.ts')).toMatchInlineSnapshot(`
    "import { defineWorkspace } from 'vitest/config'

    export default defineWorkspace([
      // If you want to keep running your existing tests in Node.js, uncomment the next line.
      // 'vitest.config.ts',
      {
        extends: 'vitest.config.ts',
        test: {
          browser: {
            enabled: true,
            provider: 'preview',
            instances: [
            ],
          },
        },
      },
    ])
    "
  `)

  expect(await getFiles('/vitest-example')).toMatchInlineSnapshot(`
    [
      "HelloWorld.test.ts",
      "HelloWorld.ts",
    ]
  `)
})

async function getFiles(subDir = '') {
  return await readdir(cwd + subDir)
}

async function getFileContent(subDir = '') {
  return await readFile(cwd + subDir, 'utf8')
}
