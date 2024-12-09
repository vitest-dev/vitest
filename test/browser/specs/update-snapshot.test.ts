import { readFileSync } from 'node:fs'
import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { createFile, editFile } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

test('update snapshot', async () => {
  // setup wrong snapshot value
  const snapshotPath = './fixtures/update-snapshot/__snapshots__/basic.test.ts.snap'
  editFile(snapshotPath, data => data.replace('`1`', '`2`'))
  const basicFixturePath = './fixtures/update-snapshot/basic-fixture.ts'
  const testPath = './fixtures/update-snapshot/basic.test.ts'
  createFile(testPath, readFileSync(basicFixturePath, 'utf-8'))

  // run vitest watch mode
  const ctx = await runBrowserTests({
    watch: true,
    root: './fixtures/update-snapshot',
    project: [instances[0].browser], // TODO 2024-12-11 Sheremet V.A. test with multiple browsers
    reporters: ['default'], // use simple reporter to not pollute stdout
    browser: { headless: true },
  }, [], {
    server: {
      // ignore the watcher update
      watch: null,
    },
  })
  const { exitCode, ctx: vitest } = ctx
  onTestFinished(() => vitest.close())
  onTestFailed(() => {
    console.error(ctx.stdout)
    console.error(ctx.stderr)
  })

  // test fails
  expect(exitCode).toBe(1)

  const files = vitest.state.getFiles()
  expect(files).toHaveLength(1)
  expect(files[0].result.state).toBe('fail')

  // updateSnapshot API to simulate "u" command
  await vitest.updateSnapshot()

  // verify snapshot value is updated
  const snapshotData = readFileSync(snapshotPath, 'utf-8')
  expect(snapshotData).toContain('`1`')

  const testFile = readFileSync(testPath, 'utf-8')
  expect(testFile).toContain('expect(fn).toMatchInlineSnapshot(`[MockFunction spy]`)')
  expect(testFile).toMatchSnapshot()

  // test passes
  expect(vitest.state.getFiles()[0].result.state).toBe('pass')
})
