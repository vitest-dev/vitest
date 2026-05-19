import path from 'node:path'
import { expect, onTestFinished, test, vi } from 'vitest'
import { editFile } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

test('keeps browser stack trace source maps fresh after watch rerun', async () => {
  const root = path.join(import.meta.dirname, '../fixtures/error-watch')
  const testFile = path.join(root, 'basic.test.ts')

  // run in watch mode
  const result = await runBrowserTests({
    root,
    watch: true,
    project: [instances[0].browser],
  })
  onTestFinished(async () => {
    await result.ctx.close()
  })

  // verify initial stack trace
  expect(result.errorTree({ stackTrace: true })).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": [
          "boom
        at basic.test.ts:5:8",
        ],
      },
    }
  `)

  // modify test file and trigger re-run
  result.vitest.resetOutput()
  editFile(testFile, content => content.replace(
    `\
  // a
`,
    `\
  // a
  "hello" + "world";
  // b
`,
  ))
  await result.vitest.waitForStderr('Failed Tests 1')

  // verify new stack trace
  expect(result.errorTree({ stackTrace: true })).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": [
          "boom
        at basic.test.ts:7:8",
        ],
      },
    }
  `)
})
