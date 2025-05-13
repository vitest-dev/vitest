import type { TestAnnotation } from 'vitest'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

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

    const { stderr } = await runInlineTests({
      'basic.test.ts': `
        import { test } from 'vitest'

        test('simple', ({ annotate }) => {
          annotate('1')
          annotate('2', 'warn')
          annotate('3', { path: './test-3.js' })
          annotate('4', 'warn', { path: './test-4.js' })
        })

        test('second', ({ annotate }) => {
          annotate('5')
        })
      `,
    }, {
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
        "[annotate] simple 1 undefined undefined",
        "[annotate] simple 2 warn undefined",
        "[annotate] simple 3 undefined <root>/test-3.js",
        "[annotate] simple 4 warn <root>/test-4.js",
        "[result] simple",
        "[ready] second",
        "[annotate] second 5 undefined undefined",
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
              "line": 12,
            },
            "message": "5",
          },
        ],
        "simple": [
          {
            "location": {
              "column": 11,
              "file": "<root>/basic.test.ts",
              "line": 5,
            },
            "message": "1",
          },
          {
            "location": {
              "column": 11,
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
              "column": 11,
              "file": "<root>/basic.test.ts",
              "line": 7,
            },
            "message": "3",
          },
          {
            "attachment": {
              "path": "<root>/test-4.js",
            },
            "location": {
              "column": 11,
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
