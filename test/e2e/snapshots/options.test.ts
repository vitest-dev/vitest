import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

describe('maxOutputLength', () => {
  test('default', async () => {
    const result = await runInlineTests(
      {
        'basic.test.ts': `
          import { expect, test } from 'vitest'

          test('large snapshot', () => {
            expect(Array.from({ length: 500_000 }, (_, i) => ({ i }))).toMatchSnapshot()
          })
        `,
      },
      {
        update: 'all',
      },
    )

    expect(result.stderr).toMatchInlineSnapshot(`""`)
    const snapshot = result.fs.readFile('__snapshots__/basic.test.ts.snap')
    expect(snapshot.slice(-50)).toMatchInlineSnapshot(`
      " "i": 499998,
        },
        {
          "i": 499999,
        },
      ]
      \`;
      "
    `)
    expect(snapshot.length).toMatchInlineSnapshot(`12888992`)
  })

  test('override', async () => {
    const result = await runInlineTests(
      {
        'basic.test.ts': `
          import { expect, test } from 'vitest'

          test('large snapshot', () => {
            expect(Array.from({ length: 8 }, (_, i) => ({ i }))).toMatchSnapshot()
          })
        `,
      },
      {
        update: 'all',
        snapshotFormat: {
          maxOutputLength: 50,
        },
      },
    )

    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
      "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

      exports[\`large snapshot 1\`] = \`
      [
        {
          "i": 0,
        },
        {
          "i": 1,
        },
        {
          "i": 2,
        },
        [Object],
        [Object],
        [Object],
        [Object],
        [Object],
      ]
      \`;
      "
    `)
  })
})

test('printBasicPrototype', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `
        import { expect, test } from 'vitest'

        test('non default snapshot format', () => {
          expect({ foo: ['bar'] }).toMatchInlineSnapshot()
        })
      `,
    },
    {
      update: 'all',
      snapshotFormat: {
        printBasicPrototype: true,
      },
    },
  )

  expect(result.stderr).toBe('')
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "non default snapshot format": "passed",
      },
    }
  `)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
            import { expect, test } from 'vitest'

            test('non default snapshot format', () => {
              expect({ foo: ['bar'] }).toMatchInlineSnapshot(\`
                Object {
                  \"foo\": Array [
                    \"bar\",
                  ],
                }
              \`)
            })
          "
  `)
})
