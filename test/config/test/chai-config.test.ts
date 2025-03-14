import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

describe('truncateThreshold', () => {
  it('default', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
      reporters: ['tap-flat'],
    })
    expect(cleanOutput(result.stdout)).toMatchInlineSnapshot(`
      "TAP version 13
      1..9
      ok 1 - test-each-title.test.ts > 012345678901234567890123456789 (length = 30)
      ok 2 - test-each-title.test.ts > 0123456789012345678901234567890123456… (length = 40)
      ok 3 - test-each-title.test.ts > 0123456789012345678901234567890123456… (length = 50)
      ok 4 - test-each-title.test.ts > [ 'one', 'two', 'three' ]
      ok 5 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four' ]
      ok 6 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four', …(1) ]
      ok 7 - test-each-title.test.ts > { one: 1, two: 2, three: 3 }
      ok 8 - test-each-title.test.ts > { one: 1, two: 2, three: 3, four: 4 }
      ok 9 - test-each-title.test.ts > { one: 1, two: 2, three: 3, …(2) }"
    `)
    expect(result.exitCode).toBe(0)
  })

  it('40', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
      reporters: ['tap-flat'],
      chaiConfig: {
        truncateThreshold: 40,
      },
    })
    expect(cleanOutput(result.stdout)).toMatchInlineSnapshot(`
      "TAP version 13
      1..9
      ok 1 - test-each-title.test.ts > 012345678901234567890123456789 (length = 30)
      ok 2 - test-each-title.test.ts > 0123456789012345678901234567890123456… (length = 40)
      ok 3 - test-each-title.test.ts > 0123456789012345678901234567890123456… (length = 50)
      ok 4 - test-each-title.test.ts > [ 'one', 'two', 'three' ]
      ok 5 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four' ]
      ok 6 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four', …(1) ]
      ok 7 - test-each-title.test.ts > { one: 1, two: 2, three: 3 }
      ok 8 - test-each-title.test.ts > { one: 1, two: 2, three: 3, four: 4 }
      ok 9 - test-each-title.test.ts > { one: 1, two: 2, three: 3, …(2) }"
    `)
    expect(result.exitCode).toBe(0)
  })

  it('0', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
      reporters: ['tap-flat'],
      chaiConfig: {
        truncateThreshold: 0,
      },
    })
    expect(cleanOutput(result.stdout)).toMatchInlineSnapshot(`
      "TAP version 13
      1..9
      ok 1 - test-each-title.test.ts > 012345678901234567890123456789 (length = 30)
      ok 2 - test-each-title.test.ts > 0123456789012345678901234567890123456789 (length = 40)
      ok 3 - test-each-title.test.ts > 01234567890123456789012345678901234567890123456789 (length = 50)
      ok 4 - test-each-title.test.ts > [ 'one', 'two', 'three' ]
      ok 5 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four' ]
      ok 6 - test-each-title.test.ts > [ 'one', 'two', 'three', 'four', 'five' ]
      ok 7 - test-each-title.test.ts > { one: 1, two: 2, three: 3 }
      ok 8 - test-each-title.test.ts > { one: 1, two: 2, three: 3, four: 4 }
      ok 9 - test-each-title.test.ts > { one: 1, two: 2, three: 3, four: 4, five: 5 }"
    `)
    expect(result.exitCode).toBe(0)
  })
})

function cleanOutput(output: string) {
  // remove non-deterministic output
  return output.replaceAll(/\s*# time=.*/g, '').trim()
}
