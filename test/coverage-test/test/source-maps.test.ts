import { expect } from 'vitest'
import { isBrowser, runVitest, test } from '../utils'

test('errors point to correct location', async () => {
  const { stderr } = await runVitest({
    include: ['fixtures/test/error-location.test.ts'],
    coverage: { reporter: 'json' },
  }, { throwOnError: false })

  if (isBrowser()) {
    expect(stderr).toMatch(`
❯ throws fixtures/src/throws-error.ts:29:11
     27|    */
     28|    function throws() {
     29|      throw new Error("Expected error")
       |           ^
     30|    }
    `.trim())
  }
  else {
    expect(stderr).toMatch(`
❯ throws fixtures/src/throws-error.ts:29:12
     27|    */
     28|    function throws() {
     29|      throw new Error("Expected error")
       |            ^
     30|    }
    `.trim())
  }
})
