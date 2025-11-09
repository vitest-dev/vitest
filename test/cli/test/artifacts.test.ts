import type { TestAnnotation, TestArtifact } from 'vitest'
import { format } from 'node:util'
import { playwright } from '@vitest/browser-playwright'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const test3Content = /* ts */`
export async function externalArtifactRecord(recordArtifact, task) {
  await recordArtifact({ type: 'external' }, task)
}
`

const annotationTest = /* ts */`
import { test, describe, recordArtifact } from 'vitest'
import { externalArtifactRecord } from './test-3.js'

test('simple', async ({ task }) => {
  await recordArtifact({ type: '1' }, task)
  await recordArtifact({ type: '2' }, task)
  await recordArtifact({ type: '3', attachments: [{ path: './test-3.js' }] }, task)
  await recordArtifact({ type: '4', attachments: [{ path: './test-4.js' }] }, task)
  await externalArtifactRecord(recordArtifact, task)
  await recordArtifact({ type: 'with base64 body', attachments: [{ body: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' }]}, task)
  await recordArtifact({ type: 'with Uint8Array body', attachments: [{ body: new Uint8Array(Array.from({ length: 256 }).map((_, i) => i)) }] }, task)
  await recordArtifact({ type: 'with contentType', attachments: [{ body: '', contentType: 'text/plain' }] }, task)
})

describe('suite', () => {
  test('second', async ({ task }) => {
    await recordArtifact({ type: '5' }, task)
    await recordArtifact({ type: '6', attachments: [{ path: 'https://absolute-path.com' }] }, task)
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
        provider: playwright(),
        headless: true,
        instances: [
          { browser: 'chromium' as const },
        ],
      },
    },
  ])('annotations are exposed correctly in $name', async (options) => {
    const events: string[] = []
    const annotations: Record<string, ReadonlyArray<TestAnnotation>> = {}
    const artifacts: Record<string, ReadonlyArray<TestArtifact>> = {}

    const { stderr } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      {
        includeTaskLocation: true,
        reporters: [
          'default',
          {
            onTestCaseAnnotate() {
              events.push('[annotate]')
            },
            onTestCaseArtifactRecord(testCase, artifact) {
              const path = artifact.attachments?.map(
                attachment => attachment.path?.replace(testCase.project.config.root, '<root>').replace(/\w+\.js$/, '<hash>.js'),
              )
              events.push(`[artifact] ${testCase.name} ${artifact.type} path=${format(path)} contentType=${format(artifact.attachments?.map(attachment => attachment.contentType))} body=${format(artifact.attachments?.map(attachment => attachment.body))}`)
            },
            onTestCaseReady(testCase) {
              events.push(`[ready] ${testCase.name}`)
            },
            onTestCaseResult(testCase) {
              events.push(`[result] ${testCase.name}`)
              annotations[testCase.name] = testCase.annotations()
              artifacts[testCase.name] = testCase.artifacts().map((artifact) => {
                if (Array.isArray(artifact.attachments)) {
                  for (const attachment of artifact.attachments) {
                    if (attachment?.path) {
                      attachment.path = attachment.path.replace(
                        testCase.project.config.root,
                        '<root>',
                      ).replace(/\w+\.js$/, '<hash>.js')
                    }
                  }
                }
                if (artifact.location) {
                  artifact.location.file = artifact.location.file.replace(
                    testCase.project.config.root,
                    '<root>',
                  )
                }
                return artifact
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
        "[artifact] simple 1 path=undefined contentType=undefined body=undefined",
        "[artifact] simple 2 path=undefined contentType=undefined body=undefined",
        "[artifact] simple 3 path=[ '<root>/.vitest-attachments/<hash>.js' ] contentType=[ 'text/javascript' ] body=[ undefined ]",
        "[artifact] simple 4 path=[ '<root>/.vitest-attachments/<hash>.js' ] contentType=[ 'text/javascript' ] body=[ undefined ]",
        "[artifact] simple external path=undefined contentType=undefined body=undefined",
        "[artifact] simple with base64 body path=[ undefined ] contentType=[ undefined ] body=[ 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' ]",
        "[artifact] simple with Uint8Array body path=[ undefined ] contentType=[ undefined ] body=[
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=='
      ]",
        "[artifact] simple with contentType path=[ undefined ] contentType=[ 'text/plain' ] body=[ '' ]",
        "[result] simple",
        "[ready] second",
        "[artifact] second 5 path=undefined contentType=undefined body=undefined",
        "[artifact] second 6 path=[ 'https://absolute-path.com' ] contentType=[ undefined ] body=[ undefined ]",
        "[result] second",
      ]
    `)

    expect(artifacts).toMatchInlineSnapshot(`
      {
        "second": [
          {
            "location": {
              "column": 11,
              "file": "<root>/basic.test.ts",
              "line": 18,
            },
            "type": "5",
          },
          {
            "attachments": [
              {
                "path": "https://absolute-path.com",
              },
            ],
            "location": {
              "column": 11,
              "file": "<root>/basic.test.ts",
              "line": 19,
            },
            "type": "6",
          },
        ],
        "simple": [
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 6,
            },
            "type": "1",
          },
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 7,
            },
            "type": "2",
          },
          {
            "attachments": [
              {
                "contentType": "text/javascript",
                "path": "<root>/.vitest-attachments/<hash>.js",
              },
            ],
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 8,
            },
            "type": "3",
          },
          {
            "attachments": [
              {
                "contentType": "text/javascript",
                "path": "<root>/.vitest-attachments/<hash>.js",
              },
            ],
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 9,
            },
            "type": "4",
          },
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 10,
            },
            "type": "external",
          },
          {
            "attachments": [
              {
                "body": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
              },
            ],
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 11,
            },
            "type": "with base64 body",
          },
          {
            "attachments": [
              {
                "body": "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==",
              },
            ],
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 12,
            },
            "type": "with Uint8Array body",
          },
          {
            "attachments": [
              {
                "body": "",
                "contentType": "text/plain",
              },
            ],
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 13,
            },
            "type": "with contentType",
          },
        ],
      }
    `)
    expect(annotations).toMatchInlineSnapshot(`
      {
        "second": [],
        "simple": [],
      }
    `)
  })

  test('cannot annotate tests when the test finished running', async () => {
    const { stderr } = await runInlineTests({
      'basic.test.ts': `
        import { test, recordArtifact } from 'vitest'
        test('finished early', ({ task }) => {
          setTimeout(() => {
            recordArtifact({ type: 'invalid-artifact' }, task)
          }, 50)
        })

        test('long running test ', async () => {
          await new Promise(r => setTimeout(() => r(), 100))
        })
      `,
    })
    expect(stderr).toContain('Cannot record a test artifact outside of the test run. The test "finished early" finished running with the "pass" state already.')
  })
})

describe('reporters', () => {
  test('tap reporter', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
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
          ok 2 - suite # time=<time> {
              1..1
              ok 1 - second # time=<time>
          }
      }
      "
    `)
  })

  test('tap-flat reporter', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: ['tap-flat'] },
    )

    expect(stdout.replace(/[\d.]+ms/g, '<time>')).toMatchInlineSnapshot(`
      "TAP version 13
      1..2
      ok 1 - basic.test.ts > simple # time=<time>
      ok 2 - basic.test.ts > suite > second # time=<time>
      "
    `)
  })

  test('junit reporter', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
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
              </testcase>
              <testcase classname="basic.test.ts" name="suite &gt; second" time="0">
              </testcase>
          </testsuite>
      </testsuites>
      "
    `)
  })

  test('github-actions reporter', async () => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: ['github-actions'] },
    )

    expect(ctx).toBeDefined()

    expect(stdout).toMatchInlineSnapshot(`""`)
  })

  test('verbose non-tty', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
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
       ✓ basic.test.ts > suite > second <time>
      "
    `)
  })

  test('default reporter prints annotations after the error', async () => {
    const { stdout, stderr } = await runInlineTests(
      {
        'basic.test.ts': annotationTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: [['default', { isTTY: false }]] },
    )

    expect(stdout).toContain('✓ basic.test.ts (2 tests)')
    expect(stderr).toMatchInlineSnapshot(`""`)
  })
})
