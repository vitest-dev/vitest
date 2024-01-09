import assert from 'node:assert'
import fs from 'node:fs'
import test from 'node:test'
import { startVitest } from 'vitest/node'

let vitest

test.after(async () => {
  await vitest?.close()
})

test('update snapshot', async () => {
  // setup wrong snapshot value
  const snapshotPath = './fixtures/update-snapshot/__snapshots__/basic.test.ts.snap'
  await editFile(snapshotPath, data => data.replace('`1`', '`2`'))

  // run vitest watch mode
  const result = await wrapExit(() => startVitest('test', [], {
    watch: true,
    root: './fixtures/update-snapshot',
    reporters: ['tap-flat'], // use simple reporter to not pollute stdout
    browser: { headless: true },
  }))
  vitest = result.value
  assert.ok(vitest)

  // test fails
  assert.equal(result.exitCode, 1)
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
  const data = await fs.promises.readFile(filepath, 'utf-8')
  await fs.promises.writeFile(filepath, edit(data))
}

/**
 * run function and return mutated exitCode while preserving current exitCode
 * @param {() => any} f
 */
async function wrapExit(f) {
  const prevExitCode = process.exitCode
  const prevExit = process.exit
  process.exit = () => {}
  /** @type {{ value?: any, exitCode?: number }} */
  const result = {}
  try {
    result.value = await f()
  }
  finally {
    result.exitCode = process.exitCode
    process.exitCode = prevExitCode
    process.exit = prevExit
  }
  return result
}
