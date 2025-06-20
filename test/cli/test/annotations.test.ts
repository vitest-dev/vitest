import type { TestAnnotation } from 'vitest'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const annotationTest = /* ts */`
import { test, describe } from 'vitest'

test('simple', async ({ annotate }) => {
  await annotate('1')
  await annotate('2', 'warning')
  await annotate('3', { path: './test-3.js' })
  await annotate('4', 'warning', { path: './test-4.js' })
})

describe('suite', () => {
  test('second', async ({ annotate }) => {
    await annotate('5')
    await annotate('6', { path: 'https://absolute-path.com' })
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

    const { stderr } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
      {
        includeTaskLocation: true,
        reporters: [
          'default',
          {
            onTestCaseAnnotate(testCase, annotation) {
              const path = annotation.attachment?.path?.replace(testCase.project.config.root, '<root>').replace(/\w+\.js$/, '<hash>.js')
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
                  ).replace(/\w+\.js$/, '<hash>.js')
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
      },
      {},
      {
        test: options,
      },
    )

    expect(stderr).toBe('')
    expect(events).toMatchInlineSnapshot(`
      [
        "[ready] simple",
        "[annotate] simple 1 notice undefined",
        "[annotate] simple 2 warning undefined",
        "[annotate] simple 3 notice <root>/.vitest-attachments/3-<hash>.js",
        "[annotate] simple 4 warning <root>/.vitest-attachments/4-<hash>.js",
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
              "column": 11,
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
              "column": 11,
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
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 5,
            },
            "message": "1",
            "type": "notice",
          },
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 6,
            },
            "message": "2",
            "type": "warning",
          },
          {
            "attachment": {
              "contentType": "text/javascript",
              "path": "<root>/.vitest-attachments/3-<hash>.js",
            },
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 7,
            },
            "message": "3",
            "type": "notice",
          },
          {
            "attachment": {
              "contentType": "text/javascript",
              "path": "<root>/.vitest-attachments/4-<hash>.js",
            },
            "location": {
              "column": 9,
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

  test('cannot annotate tests when the test finished running', async () => {
    const { stderr } = await runInlineTests({
      'basic.test.ts': `
        test('finished early', ({ annotate }) => {
          setTimeout(() => {
            annotate('invalid annotations')
          }, 50)
        })

        test('long running test ', async () => {
          await new Promise(r => setTimeout(() => r(), 100))
        })
      `,
    }, { globals: true })
    expect(stderr).toContain('Cannot annotate tests outside of the test run. The test "finished early" finished running with the "pass" state already.')
  })
})

describe('reporters', () => {
  test('tap reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
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
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
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
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
      { reporters: ['junit'] },
    )

    const result = stdout
      .replace(/time="[\d.]+"/g, 'time="0"')
      .replace(/timestamp="[\w\-:.]+"/g, 'timestamp="0"')
      .replace(/hostname="[\w.\-]+"/g, 'hostname="CI"')

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
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
      { reporters: ['github-actions'] },
    )

    expect(ctx).toBeDefined()

    // the file path is escaped on windows
    const result = stdout
      .replace(/file=(\w)%3A/g, 'file=$1:')
      .replace(new RegExp(ctx!.config.root, 'g'), '<root>')
    expect(result).toMatchInlineSnapshot(`
      "
      ::notice file=<root>/basic.test.ts,line=5,column=9::1

      ::warning file=<root>/basic.test.ts,line=6,column=9::2

      ::notice file=<root>/basic.test.ts,line=7,column=9::3

      ::warning file=<root>/basic.test.ts,line=8,column=9::4

      ::notice file=<root>/basic.test.ts,line=13,column=11::5

      ::notice file=<root>/basic.test.ts,line=14,column=11::6
      "
    `)
  })

  test('verbose non-tty reporter prints annotations', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': '',
        'test-4.js': '',
      },
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

         ❯ basic.test.ts:5:9 notice
           ↳ 1
         ❯ basic.test.ts:6:9 warning
           ↳ 2
         ❯ basic.test.ts:7:9 notice
           ↳ 3
         ❯ basic.test.ts:8:9 warning
           ↳ 4

       ✓ basic.test.ts > suite > second <time>

         ❯ basic.test.ts:13:11 notice
           ↳ 5
         ❯ basic.test.ts:14:11 notice
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
