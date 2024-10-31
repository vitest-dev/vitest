import fs from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

function fsUpdate(file: string, updateFn: (data: string) => string) {
  fs.writeFileSync(file, updateFn(fs.readFileSync(file, 'utf-8')))
}

test('summary', async () => {
  // cleanup snapshot
  const dir = join(import.meta.dirname, 'fixtures/summary')
  const testFile = join(dir, 'basic.test.ts')
  const snapshotFile = join(dir, '__snapshots__/basic.test.ts.snap')
  fsUpdate(testFile, s => s.replace(/`"@SNAP\d"`/g, ''))
  fs.rmSync(snapshotFile, { recursive: true, force: true })

  // write everything
  let vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  12 written')

  // write partially
  fsUpdate(testFile, s => s.replace('`"@SNAP2"`', ''))
  fsUpdate(snapshotFile, s => s.replace('exports[`file repeats 1`] = `"@SNAP5"`;', ''))
  vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 written')

  // update partially
  fsUpdate(testFile, s => s.replace('`"@SNAP2"`', '`"@WRONG"`'))
  fsUpdate(snapshotFile, s => s.replace('`"@SNAP5"`', '`"@WRONG"`'))
  vitest = await runVitest({
    root: 'test/fixtures/summary',
    update: true,
  })
  expect(vitest.stdout).toContain('Snapshots  2 updated')
})
