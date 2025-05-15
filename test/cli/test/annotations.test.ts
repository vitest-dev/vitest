import type { TestAnnotation } from 'vitest'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const annotationTest = /* ts */`
import { test, describe } from 'vitest'

test('simple', ({ annotate }) => {
  annotate('1')
  annotate('2', 'warn')
  annotate('3', { path: './test-3.js' })
  annotate('4', 'warn', { path: './test-4.js' })
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
        "[annotate] simple 2 warn undefined",
        "[annotate] simple 3 notice <root>/test-3.js",
        "[annotate] simple 4 warn <root>/test-4.js",
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
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 12,
            },
            "message": "5",
            "type": "notice",
          },
          {
            "attachment": {
              "path": "https://absolute-path.com",
            },
            "location": {
              "column": 3,
              "file": "<root>/basic.test.ts",
              "line": 13,
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
            "type": "warn",
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
            "type": "warn",
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
              # warn: 2
              # notice: 3
              # warn: 4
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
          # warn: 2
          # notice: 3
          # warn: 4
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
                      <property name="warn" value="2">
                      </property>
                      <property name="notice" value="3">
                      </property>
                      <property name="warn" value="4">
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

      ::notice file=<root>/basic.test.ts,line=6,column=3,title=warn::2

      ::notice file=<root>/basic.test.ts,line=7,column=3::3

      ::notice file=<root>/basic.test.ts,line=8,column=3,title=warn::4

      ::notice file=<root>/basic.test.ts,line=13,column=5::5

      ::notice file=<root>/basic.test.ts,line=14,column=5::6
      "
    `)
  })
})
