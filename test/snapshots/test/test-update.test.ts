import fs, { rmSync } from 'node:fs'
import { join } from 'node:path'
import { globSync } from 'tinyglobby'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('test update', async () => {
  // copy fixtures/test-update to fixtures/test-update-result
  const srcDir = join(import.meta.dirname, 'fixtures/test-update')
  const dstDir = join(import.meta.dirname, 'fixtures/test-update-result')
  rmSync(dstDir, { recursive: true })
  fs.cpSync(srcDir, dstDir, { recursive: true })

  // run and update snapshots
  const result = await runVitest({ root: dstDir, update: true })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "inline-concurrent.test.js": Object {
        "1st": "passed",
        "2nd": "passed",
        "3rd": "passed",
      },
      "inline.test.js": Object {
        "snapshots are generated in correct order": Object {
          "first snapshot": "passed",
          "second snapshot": "passed",
        },
        "snapshots with properties": Object {
          "mixed with and without snapshot": "passed",
          "with snapshot": "passed",
          "without snapshot": "passed",
        },
      },
      "retry-file.test.ts": Object {
        "file repeats": "passed",
        "file repeats many": "passed",
        "file retry": "passed",
        "file retry many": "passed",
        "file retry partial": "passed",
      },
      "retry-inline.test.ts": Object {
        "inline repeats": "passed",
        "inline retry": "passed",
      },
      "same-title-file.test.js": Object {
        "same title exist": "passed",
        "same title new": "passed",
      },
      "same-title-inline.test.js": Object {
        "same title": "passed",
      },
    }
  `)
  const resultFiles = readFiles(dstDir)
  expect(Object.keys(resultFiles)).toMatchInlineSnapshot(`
    Array [
      "__snapshots__/retry-file.test.ts.snap",
      "__snapshots__/same-title-file.test.js.snap",
      "inline-concurrent.test.js",
      "inline.test.js",
      "retry-file.test.ts",
      "retry-inline.test.ts",
      "same-title-file.test.js",
      "same-title-inline.test.js",
    ]
  `)

  // re-run without update and files are unchanged
  const result2 = await runVitest({ root: dstDir, update: 'none' })
  expect(result2.stderr).toMatchInlineSnapshot(`""`)
  expect(result2.errorTree()).toEqual(result.errorTree())
  expect(readFiles(dstDir)).toEqual(resultFiles)

  const result3 = await runVitest({ root: dstDir, update: 'new' })
  expect(result3.stderr).toMatchInlineSnapshot(`""`)
  expect(result3.errorTree()).toEqual(result.errorTree())
  expect(readFiles(dstDir)).toEqual(resultFiles)
})

function readFiles(dir: string) {
  const files = globSync('**', { cwd: dir, ignore: ['**/node_modules/**'] })
  return Object.fromEntries(
    files.sort().map(file => [file, fs.readFileSync(join(dir, file), 'utf-8')]),
  )
}
