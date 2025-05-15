import type { TestAnnotation } from 'vitest'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const annotationTest = /* ts */`
import { test, describe } from 'vitest'

test('simple', ({ annotate }) => {
  annotate('1')
  annotate('2', 'warning')
  annotate('3', { path: './test-3.js' })
  annotate('4', 'warning', { path: './test-4.js' })
})

describe('suite', () => {
  test('second', ({ annotate }) => {
    annotate('5')
    annotate('6', { path: 'https://absolute-path.com' })
  })
})
`

describe('API', () => {
  test.for([
    { name: 'forks', pool: 'forks' },
    { name: 'threads', pool: 'threads' },
    {
      name: 'browser',
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
  ])('annotations are exposed correctly in $name', async (options) => {
    const events: string[] = []
    const annotations: Record<string, ReadonlyArray<TestAnnotation>> = {}

    const { stderr } = await runInlineTests({ 'basic.test.ts': annotationTest }, {
      ...options,
      includeTaskLocation: true,
      reporters: [
        'default',
        {
          onTestCaseAnnotate(testCase, annotation) {
            const path = annotation.attachment?.path?.replace(testCase.project.config.root, '<root>')
            events.push(`[annotate] ${testCase.name} ${annotation.message} ${annotation.type} ${path}`)
          },
          onTestCaseReady(testCase) {
            events.push(`[ready] ${testCase.name}`)
          },
          onTestCaseResult(testCase) {
            events.push(`[result] ${testCase.name}`)
            annotations[testCase.name] = testCase.annotations().map((annotation) => {
              if (annotation.attachment?.path) {
                annotation.attachment.path = annotation.attachment.path.replace(
                  testCase.project.config.root,
                  '<root>',
                )
              }
              if (annotation.location) {
                annotation.location.file = annotation.location.file.replace(
                  testCase.project.config.root,
                  '<root>',
                )
              }
              return annotation
            })
          },
        },
      ],
    })

    expect(stderr).toBe('')
    expect(events).toMatchInlineSnapshot(`
      [
        "[ready] simple",
        "[annotate] simple 1 notice undefined",
        "[annotate] simple 2 warning undefined",
        "[annotate] simple 3 notice <root>/test-3.js",
        "[annotate] simple 4 warning <root>/test-4.js",
        "[result] simple",
        "[ready] second",
        "[annotate] second 5 notice undefined",
        "[annotate] second 6 notice https://absolute-path.com",
        "[result] second",
      ]
    `)

    expect(annotations).toMatchInlineSnapshot(`
      {
        "second": [
          {
            "location": {
              "column": 5,
              "file": "<root>/basic.test.ts",
              "line": 13,
            },
            "message": "5",
            "type": "notice",
          },
          {
            "attachment": {
              "path": "https://absolute-path.com",
            },
            "location": {
              "column": 5,
              "file": "<root>/basic.test.ts",
              "line": 14,
            },
            "message": "6",
            "type": "notice",
          },
        ],
        "simple": [
          {
            "location": {
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 5,
            },
            "message": "1",
            "type": "notice",
          },
          {
            "location": {
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 6,
            },
            "message": "2",
            "type": "warning",
          },
          {
            "attachment": {
              "path": "<root>/test-3.js",
            },
            "location": {
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 7,
            },
            "message": "3",
            "type": "notice",
          },
          {
            "attachment": {
              "path": "<root>/test-4.js",
            },
            "location": {
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 8,
            },
            "message": "4",
            "type": "warning",
          },
        ],
      }
    `)
  })
})

describe('reporters', () => {
  test('tap reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      { 'basic.test.ts': annotationTest },
      { reporters: ['tap'] },
    )

    expect(stdout.replace(/[\d.]+ms/g, '<time>')).toMatchInlineSnapshot(`
      "TAP version 13
      1..1
      ok 1 - basic.test.ts # time=<time> {
          1..2
          ok 1 - simple # time=<time>
              # notice: 1
              # warning: 2
              # notice: 3
              # warning: 4
          ok 2 - suite # time=<time> {
              1..1
              ok 1 - second # time=<time>
                  # notice: 5
                  # notice: 6
          }
      }
      "
    `)
  })

  test('tap-flat reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      { 'basic.test.ts': annotationTest },
      { reporters: ['tap-flat'] },
    )

    expect(stdout.replace(/[\d.]+ms/g, '<time>')).toMatchInlineSnapshot(`
      "TAP version 13
      1..2
      ok 1 - basic.test.ts > simple # time=<time>
          # notice: 1
          # warning: 2
          # notice: 3
          # warning: 4
      ok 2 - basic.test.ts > suite > second # time=<time>
          # notice: 5
          # notice: 6
      "
    `)
  })

  test('junit reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      { 'basic.test.ts': annotationTest },
      { reporters: ['junit'] },
    )

    const result = stdout
      .replace(/time="[\d.]+"/g, 'time="0"')
      .replace(/timestamp="[\w\-:.]+"/g, 'timestamp="0"')
      .replace(/hostname="[\w.]+"/g, 'hostname="CI"')

    expect(result).toMatchInlineSnapshot(`
      "<?xml version="1.0" encoding="UTF-8" ?>
      <testsuites name="vitest tests" tests="2" failures="0" errors="0" time="0">
          <testsuite name="basic.test.ts" timestamp="0" hostname="CI" tests="2" failures="0" errors="0" skipped="0" time="0">
              <testcase classname="basic.test.ts" name="simple" time="0">
                  <properties>
                      <property name="notice" value="1">
                      </property>
                      <property name="warning" value="2">
                      </property>
                      <property name="notice" value="3">
                      </property>
                      <property name="warning" value="4">
                      </property>
                  </properties>
              </testcase>
              <testcase classname="basic.test.ts" name="suite &gt; second" time="0">
                  <properties>
                      <property name="notice" value="5">
                      </property>
                      <property name="notice" value="6">
                      </property>
                  </properties>
              </testcase>
          </testsuite>
      </testsuites>
      "
    `)
  })

  test('github-actions reporter prints annotations', async () => {
    const { stdout, ctx } = await runInlineTests(
      { 'basic.test.ts': annotationTest },
      { reporters: ['github-actions'] },
    )

    expect(ctx).toBeDefined()

    const result = stdout.replace(new RegExp(ctx!.config.root, 'g'), '<root>')
    expect(result).toMatchInlineSnapshot(`
      "
      ::notice file=<root>/basic.test.ts,line=5,column=3::1

      ::warning file=<root>/basic.test.ts,line=6,column=3::2

      ::notice file=<root>/basic.test.ts,line=7,column=3::3

      ::warning file=<root>/basic.test.ts,line=8,column=3::4

      ::notice file=<root>/basic.test.ts,line=13,column=5::5

      ::notice file=<root>/basic.test.ts,line=14,column=5::6
      "
    `)
  })

  test('verbose non-tty reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      { 'basic.test.ts': annotationTest },
      { reporters: [['verbose', { isTTY: false }]] },
    )

    const result = stdout
      .replace(/\d+ms/g, '<time>')
      .split('\n')
      // remove banner and summary
      .slice(3, -6)
      .join('\n')

    expect(result).toMatchInlineSnapshot(`
      " ✓ basic.test.ts > simple <time>

         ❯ basic.test.ts:5:3 notice
           ↳ 1
         ❯ basic.test.ts:6:3 warning
           ↳ 2
         ❯ basic.test.ts:7:3 notice
           ↳ 3
         ❯ basic.test.ts:8:3 warning
           ↳ 4

       ✓ basic.test.ts > suite > second <time>

         ❯ basic.test.ts:13:5 notice
           ↳ 5
         ❯ basic.test.ts:14:5 notice
           ↳ 6

      "
    `)
  })

  describe('default', () => {
    test('default reporter prints annotations after the error', async () => {
      const { stdout, stderr } = await runInlineTests(
        {
          'basic.test.ts': /* ts */`
            import { test } from 'vitest'

            test('non-failing test', ({ annotate }) => {
              annotate('[non-failing] not printed')
            })

            test('failed test', ({ annotate }) => {
              annotate('printed')
              annotate('also printed', 'warning')
              throw new Error('thrown error')
            })
          `,
        },
        { reporters: [['default', { isTTY: false }]] },
      )

      expect(stdout).not.toContain('[non-failing] not printed')
      expect(stderr).not.toContain('[non-failing] not printed')

      expect(stderr).toMatchInlineSnapshot(`
        "
        ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

         FAIL  basic.test.ts > failed test
        Error: thrown error
         ❯ basic.test.ts:11:21
              9|               annotate('printed')
             10|               annotate('also printed', 'warning')
             11|               throw new Error('thrown error')
               |                     ^
             12|             })
             13|           

         ❯ basic.test.ts:9:15 notice
           ↳ printed
         ❯ basic.test.ts:10:15 warning
           ↳ also printed

        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

        "
      `)
    })

    test('default reporter prints the same error with the same annotations only once', async () => {
      const { stderr } = await runInlineTests(
        {
          'basic.test.ts': /* ts */`
            import { test } from 'vitest'

            test.for([1, 2])('failed test %i', (num, { annotate }) => {
              annotate('printed')
              throw new Error('thrown error')
            })
          `,
        },
        { reporters: [['default', { isTTY: false }]] },
      )

      expect(stderr).toMatchInlineSnapshot(`
        "
        ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

         FAIL  basic.test.ts > failed test 1
         FAIL  basic.test.ts > failed test 2
        Error: thrown error
         ❯ basic.test.ts:6:21
              4|             test.for([1, 2])('failed test %i', (num, { annotate }) => {
              5|               annotate('printed')
              6|               throw new Error('thrown error')
               |                     ^
              7|             })
              8|           

         ❯ basic.test.ts:5:15 notice
           ↳ printed

        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

        "
      `)
    })

    test('default reporter prints different annotations after the same error', async () => {
      const { stderr } = await runInlineTests(
        {
          'basic.test.ts': /* ts */`
            import { test } from 'vitest'

            test.for([1, 2])('failed test %i', (num, { annotate }) => {
              annotate('printed ' + num)
              throw new Error('thrown error')
            })
          `,
        },
        { reporters: [['default', { isTTY: false }]] },
      )

      expect(stderr).toMatchInlineSnapshot(`
        "
        ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

         FAIL  basic.test.ts > failed test 1
        Error: thrown error
         ❯ basic.test.ts:6:21
              4|             test.for([1, 2])('failed test %i', (num, { annotate }) => {
              5|               annotate('printed ' + num)
              6|               throw new Error('thrown error')
               |                     ^
              7|             })
              8|           

         ❯ basic.test.ts:5:15 notice
           ↳ printed 1

        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

         FAIL  basic.test.ts > failed test 2
        Error: thrown error
         ❯ basic.test.ts:6:21
              4|             test.for([1, 2])('failed test %i', (num, { annotate }) => {
              5|               annotate('printed ' + num)
              6|               throw new Error('thrown error')
               |                     ^
              7|             })
              8|           

         ❯ basic.test.ts:5:15 notice
           ↳ printed 2

        ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

        "
      `)
    })
  })
})
