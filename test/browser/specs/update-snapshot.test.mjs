import assert from 'node:assert'
import fs from 'node:fs'
import test from 'node:test'
import { startVitest } from 'vitest/node'

let vitest

test.after(async () => {
  // force exitCode mutated by vitest
  process.exitCode = 0
  await vitest?.close()
})

test('update snapshot', async () => {
  // setup wrong snapshot value
  const snapshotPath = './fixtures/update-snapshot/__snapshots__/basic.test.ts.snap'
  await editFile(snapshotPath, data => data.replace('`1`', '`2`'))

  // run vitest watch mode
  vitest = await startVitest('test', [], {
    watch: true,
    root: './fixtures/update-snapshot',
    reporters: ["tap-flat"], // use simple reporter to not pollute stdout
    browser: { headless: true },
  })
  assert.ok(vitest)

  // test fails
  assert.equal(vitest.state.getFiles()[0].result.state, 'fail')

  // updateSnapshot API to simulate "u" commmand
  await vitest.updateSnapshot()

  // verify snapshot value is updated
  const snapshotData = await fs.promises.readFile(snapshotPath, 'utf-8')
  assert.match(snapshotData, /`1`/)

  // test passes
  assert.equal(vitest.state.getFiles()[0].result.state, 'pass')
})

/**
 * @param {string} filepath
 * @param {(data: string) => string} edit
 */
async function editFile(filepath, edit) {
  let data = await fs.promises.readFile(filepath, 'utf-8')
  await fs.promises.writeFile(filepath, edit(data))
}
