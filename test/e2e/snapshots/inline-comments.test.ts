import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('writes inline snapshots when comments sit between the matcher and its parentheses', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `import { expect, test } from 'vitest'

test('line comment', () => {
  expect('--line--').toMatchInlineSnapshot
    // this comment used to break snapshot updates
    ()
})

test('block comment', () => {
  expect('--block--').toMatchInlineSnapshot/* this comment used to break snapshot updates */()
})

test('multiple comments', () => {
  expect('--multiple--').toMatchInlineSnapshot
    // first comment
    /* second comment */ // third comment
    ()
})

test('throwing matcher', () => {
  expect(() => { throw new Error('--error--') }).toThrowErrorMatchingInlineSnapshot/* comment */()
})

test('property matchers', () => {
  expect({ a: 1 }).toMatchInlineSnapshot/* comment */({ a: expect.any(Number) })
})

test('comment-like sequences inside strings', () => {
  expect('a // b /* c */ d').toMatchInlineSnapshot()
})
`,
    },
    {
      update: 'new',
    },
  )

  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "import { expect, test } from 'vitest'

    test('line comment', () => {
      expect('--line--').toMatchInlineSnapshot
        // this comment used to break snapshot updates
        (\`"--line--"\`)
    })

    test('block comment', () => {
      expect('--block--').toMatchInlineSnapshot/* this comment used to break snapshot updates */(\`"--block--"\`)
    })

    test('multiple comments', () => {
      expect('--multiple--').toMatchInlineSnapshot
        // first comment
        /* second comment */ // third comment
        (\`"--multiple--"\`)
    })

    test('throwing matcher', () => {
      expect(() => { throw new Error('--error--') }).toThrowErrorMatchingInlineSnapshot/* comment */(\`[Error: --error--]\`)
    })

    test('property matchers', () => {
      expect({ a: 1 }).toMatchInlineSnapshot/* comment */({ a: expect.any(Number) }, \`
        {
          "a": Any<Number>,
        }
      \`)
    })

    test('comment-like sequences inside strings', () => {
      expect('a // b /* c */ d').toMatchInlineSnapshot(\`"a // b /* c */ d"\`)
    })
    "
  `)
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "block comment": "passed",
        "comment-like sequences inside strings": "passed",
        "line comment": "passed",
        "multiple comments": "passed",
        "property matchers": "passed",
        "throwing matcher": "passed",
      },
    }
  `)
})

test('updates existing inline snapshots when comments sit between the matcher and its parentheses', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `import { expect, test } from 'vitest'

test('line comment', () => {
  expect('--line-updated--').toMatchInlineSnapshot
    // this comment used to break snapshot updates
    (\`"--line--"\`)
})

test('block comment', () => {
  expect('--block-updated--').toMatchInlineSnapshot/* this comment used to break snapshot updates */(\`"--block--"\`)
})

test('throwing matcher', () => {
  expect(() => { throw new Error('--error-updated--') }).toThrowErrorMatchingInlineSnapshot/* comment */(\`[Error: --error--]\`)
})
`,
    },
    {
      update: 'all',
    },
  )

  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "import { expect, test } from 'vitest'

    test('line comment', () => {
      expect('--line-updated--').toMatchInlineSnapshot
        // this comment used to break snapshot updates
        (\`"--line-updated--"\`)
    })

    test('block comment', () => {
      expect('--block-updated--').toMatchInlineSnapshot/* this comment used to break snapshot updates */(\`"--block-updated--"\`)
    })

    test('throwing matcher', () => {
      expect(() => { throw new Error('--error-updated--') }).toThrowErrorMatchingInlineSnapshot/* comment */(\`[Error: --error-updated--]\`)
    })
    "
  `)
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "block comment": "passed",
        "line comment": "passed",
        "throwing matcher": "passed",
      },
    }
  `)
})
