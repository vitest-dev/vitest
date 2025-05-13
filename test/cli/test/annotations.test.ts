import type { TestAnnotation } from 'vitest'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

describe('API', () => {
  test('the `onTestAnnotate` hook is called correctly', async () => {
    const events: string[] = []
    const annotations: Record<string, ReadonlyArray<TestAnnotation>> = {}

    const {} = await runInlineTests({
      'basic.test.js': `
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
      reporters: [
        {
          onTestCaseAnnotate(testCase, annotation) {
            const path = annotation.attachment?.path.replace(testCase.project.config.root, '<root>')
            events.push(`[annotate] ${testCase.name} ${annotation.message} ${annotation.type} ${path}`)
          },
          onTestCaseReady(testCase) {
            events.push(`[ready] ${testCase.name}`)
          },
          onTestCaseResult(testCase) {
            events.push(`[result] ${testCase.name}`)
            annotations[testCase.name] = testCase.annotations().map((annotation) => {
              if (annotation.attachment) {
                annotation.attachment.path = annotation.attachment.path.replace(
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
            "message": "5",
          },
        ],
        "simple": [
          {
            "message": "1",
          },
          {
            "message": "2",
            "type": "warn",
          },
          {
            "attachment": {
              "path": "<root>/test-3.js",
            },
            "message": "3",
          },
          {
            "attachment": {
              "path": "<root>/test-4.js",
            },
            "message": "4",
            "type": "warn",
          },
        ],
      }
    `)
  })
})
