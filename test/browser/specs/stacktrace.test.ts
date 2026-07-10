import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test(`stack trace points to correct file in every browser when failed`, async () => {
  expect.assertions(30)
  const { stderr } = await runBrowserTests({
    root: './fixtures/failing',
    reporters: [
      'default',
      {
        onTestCaseReady(testCase) {
          if (testCase.name !== 'correctly fails and prints a diff') {
            return
          }
          if (testCase.project.name === 'chromium' || testCase.project.name === 'chrome') {
            expect(testCase.result().errors?.[0].stacks).toEqual([
              {
                line: 11,
                column: 12,
                file: testCase.module.moduleId,
                method: '',
              },
            ])
          }
        },
      },
    ],
  })

  expect(stderr).toContain('expected 1 to be 2')
  expect(stderr).toMatch(/- 2\s+\+ 1/)
  // expect(stderr).toContain('Expected to be')
  // expect(stderr).toContain('But got')
  expect(stderr).toContain('Failure screenshot')
  expect(stderr).toContain('__screenshots__/failing')

  expect(stderr).toContain('Access denied to "/inaccessible/path".')

  // depending on the browser it references either `.toBe()` or `expect()`
  expect(stderr).toMatch(/failing.test.ts:11:(12|17)/)

  // column is 18 in safari, 8 in others
  expect(stderr).toMatch(/throwError src\/error.ts:8:(18|8)/)

  expect(stderr).toContain('The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.')
  expect(stderr).toMatch(/failing.test.ts:19:(27|36)/)
  expect(stderr).toMatch(/failing.test.ts:20:(27|33)/)
  expect(stderr).toMatch(/failing.test.ts:21:(27|39)/)
  expect(stderr).toMatch(/failing.test.ts:22:(12|17)/)
  expect(stderr).toMatch(/failing.test.ts:23:(12|21)/)
  expect(stderr).toMatch(/failing.test.ts:24:(12|17)/)
  expect(stderr).toMatch(/failing.test.ts:25:(12|16)/)
  expect(stderr).toMatch(/failing.test.ts:26:(12|18)/)
  expect(stderr).toMatch(/failing.test.ts:27:(12|16)/)
  expect(stderr).toMatch(/failing.test.ts:28:(12|24)/)
  expect(stderr).toMatch(/failing.test.ts:29:(12|17)/)
  expect(stderr).toMatch(/failing.test.ts:30:(12|19)/)
  expect(stderr).toMatch(/failing.test.ts:31:(12|20)/)
  expect(stderr).toMatch(/failing.test.ts:32:(12|18)/)
  expect(stderr).toMatch(/failing.test.ts:33:(12|18)/)
  expect(stderr).toMatch(/failing.test.ts:34:(12|26)/)
  expect(stderr).toMatch(/failing.test.ts:35:(12|18)/)

  expect(stderr).toMatch(/bundled-lib\/src\/b.js:2:(9|19)/)
  expect(stderr).toMatch(/bundled-lib\/src\/index.js:5:(16|18)/)

  // index() is called from a bundled file
  expect(stderr).toMatch(/failing.test.ts:39:(2|8)/)

  // "not awaited but with then/catch/finally" test should not produce warnings
  expect(stderr).not.toMatch(/failing.test.ts:4[3-8]/)
})
