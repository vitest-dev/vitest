import fs, { readFileSync } from 'node:fs'
import { expect, onTestFinished, test } from 'vitest'
import { createFile, editFile, resolvePath } from '../../test-utils'
import { runBrowserTests } from './utils'

test('update snapshot', async () => {
  // setup wrong snapshot value
  const snapshotPath = './fixtures/update-snapshot/__snapshots__/basic.test.ts.snap'
  editFile(snapshotPath, data => data.replace('`1`', '`2`'))
  const basicFixturePath = resolvePath(import.meta.url, './fixtures/update-snapshot/basic.test.ts')
  createFile('./fixtures/update-snapshot/basic.test.ts', readFileSync(basicFixturePath, 'utf-8'))

  // run vitest watch mode
  const ctx = await runBrowserTests({
    watch: true,
    root: './fixtures/update-snapshot',
    reporters: ['default'], // use simple reporter to not pollute stdout
    browser: { headless: true },
  })
  const { exitCode, ctx: vitest } = ctx
  onTestFinished(() => vitest.close())

  // test fails
  expect(exitCode).toBe(1)

  const files = vitest.state.getFiles()
  expect(files).toHaveLength(1)
  expect(files[0].result.state).toBe('fail')

  // updateSnapshot API to simulate "u" commmand
  await vitest.updateSnapshot()

  // verify snapshot value is updated
  const snapshotData = await fs.promises.readFile(snapshotPath, 'utf-8')
  expect(snapshotData).toContain('`1`')

  // test passes
  expect(vitest.state.getFiles()[0].result.state).toBe('pass')
})
