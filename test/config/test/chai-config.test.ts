import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

describe('truncateThreshold', () => {
  it('default', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "test-each-title.test.ts": {
          "'012345678901234567890123456789' (length = 30)": "passed",
          "'01234567890123456789012345678901234...' (length = 40)": "passed",
          "'01234567890123456789012345678901234...' (length = 50)": "passed",
          "[ 'one', 'two', 'three' ]": "passed",
          "[ 'one', 'two', 'three', 'four' ]": "passed",
          "[ Array(5) ]": "passed",
          "{ Object (one, two, ...) }": "passed",
          "{ one: 1, two: 2, three: 3 }": "passed",
          "{ one: 1, two: 2, three: 3, four: 4 }": "passed",
        },
      }
    `)
  })

  it('40', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
      chaiConfig: {
        truncateThreshold: 40,
      },
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "test-each-title.test.ts": {
          "'012345678901234567890123456789' (length = 30)": "passed",
          "'01234567890123456789012345678901234...' (length = 40)": "passed",
          "'01234567890123456789012345678901234...' (length = 50)": "passed",
          "[ 'one', 'two', 'three' ]": "passed",
          "[ 'one', 'two', 'three', 'four' ]": "passed",
          "[ Array(5) ]": "passed",
          "{ Object (one, two, ...) }": "passed",
          "{ one: 1, two: 2, three: 3 }": "passed",
          "{ one: 1, two: 2, three: 3, four: 4 }": "passed",
        },
      }
    `)
  })

  it('0', async () => {
    const result = await runVitest({
      root: 'fixtures/chai-config',
      chaiConfig: {
        truncateThreshold: 0,
      },
    })
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "test-each-title.test.ts": {
          "'012345678901234567890123456789' (length = 30)": "passed",
          "'0123456789012345678901234567890123456789' (length = 40)": "passed",
          "'01234567890123456789012345678901234567890123456789' (length = 50)": "passed",
          "[ 'one', 'two', 'three' ]": "passed",
          "[ 'one', 'two', 'three', 'four' ]": "passed",
          "[ 'one', 'two', 'three', 'four', 'five' ]": "passed",
          "{ one: 1, two: 2, three: 3 }": "passed",
          "{ one: 1, two: 2, three: 3, four: 4 }": "passed",
          "{ one: 1, two: 2, three: 3, four: 4, five: 5 }": "passed",
        },
      }
    `)
  })
})
