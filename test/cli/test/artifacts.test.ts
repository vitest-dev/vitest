import type { TestAnnotation, TestArtifact } from 'vitest'
import { format } from 'node:util'
import { playwright } from '@vitest/browser-playwright'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const test3Content = /* ts */`
export async function externalArtifactRecord(recordArtifact, task) {
  await recordArtifact(task, { type: 'external' })
}
`

const artifactsTest = /* ts */`
import { test, describe, recordArtifact } from 'vitest'
import { externalArtifactRecord } from './test-3.js'

test('simple', async ({ task }) => {
  await recordArtifact(task, { type: 'with-no-attachments' })
  await recordArtifact(task, { type: 'with-one-attachment', attachments: [{ path: './test-3.js' }] })
  await recordArtifact(task, { type: 'with-multiple-attachments', attachments: [{ path: './test-3.js' }, { path: './test-4.js' }] })
  await externalArtifactRecord(recordArtifact, task)
  await recordArtifact(task, { type: 'with-base64', attachments: [{ body: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' }]})
  await recordArtifact(task, { type: 'with-bytes', attachments: [{ body: new Uint8Array(Array.from({ length: 256 }).map((_, i) => i)) }] })
  await recordArtifact(task, { type: 'with-contentType', attachments: [{ body: '', contentType: 'text/plain' }] })
})

describe('suite', () => {
  test('second', async ({ task }) => {
    await recordArtifact(task, { type: 'with-external-link', attachments: [{ path: 'https://absolute-path.com' }] })
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
  ])('artifacts are exposed correctly in $name', async (options) => {
    const events: string[] = []
    const annotations: Record<string, ReadonlyArray<TestAnnotation>> = {}
    const artifacts: Record<string, ReadonlyArray<TestArtifact>> = {}

    const { stderr } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      {
        ...options,
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
    )

    expect(stderr).toBe('')
    expect(events).toMatchInlineSnapshot(`
      [
        "[ready] simple",
        "[artifact] simple with-no-attachments path=undefined contentType=undefined body=undefined",
        "[artifact] simple with-one-attachment path=[ '<root>/.vitest-attachments/<hash>.js' ] contentType=[ 'text/javascript' ] body=[ undefined ]",
        "[artifact] simple with-multiple-attachments path=[
        '<root>/.vitest-attachments/<hash>.js',
        '<root>/.vitest-attachments/<hash>.js'
      ] contentType=[ 'text/javascript', 'text/javascript' ] body=[ undefined, undefined ]",
        "[artifact] simple external path=undefined contentType=undefined body=undefined",
        "[artifact] simple with-base64 path=[ undefined ] contentType=[ undefined ] body=[ 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' ]",
        "[artifact] simple with-bytes path=[ undefined ] contentType=[ undefined ] body=[
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=='
      ]",
        "[artifact] simple with-contentType path=[ undefined ] contentType=[ 'text/plain' ] body=[ '' ]",
        "[result] simple",
        "[ready] second",
        "[artifact] second with-external-link path=[ 'https://absolute-path.com' ] contentType=[ undefined ] body=[ undefined ]",
        "[result] second",
      ]
    `)

    expect(artifacts).toMatchInlineSnapshot(`
      {
        "second": [
          {
            "attachments": [
              {
                "path": "https://absolute-path.com",
              },
            ],
            "location": {
              "column": 11,
              "file": "<root>/basic.test.ts",
              "line": 17,
            },
            "type": "with-external-link",
          },
        ],
        "simple": [
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 6,
            },
            "type": "with-no-attachments",
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
              "line": 7,
            },
            "type": "with-one-attachment",
          },
          {
            "attachments": [
              {
                "contentType": "text/javascript",
                "path": "<root>/.vitest-attachments/<hash>.js",
              },
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
            "type": "with-multiple-attachments",
          },
          {
            "location": {
              "column": 9,
              "file": "<root>/basic.test.ts",
              "line": 9,
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
              "line": 10,
            },
            "type": "with-base64",
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
              "line": 11,
            },
            "type": "with-bytes",
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
              "line": 12,
            },
            "type": "with-contentType",
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

  test('can record artifacts even after the test finished running', async () => {
    const { stderr } = await runInlineTests({
      'basic.test.ts': `
        import { recordArtifact } from 'vitest'
        test('finished early', ({ task }) => {
          setTimeout(() => {
            recordArtifact(task, { type: 'invalid-artifact' })
          }, 50)
        })

        test('long running test ', async () => {
          await new Promise(r => setTimeout(() => r(), 100))
        })
      `,
    }, { globals: true })
    expect(stderr).toBe('')
  })
})

describe('reporters', () => {
  test('tap', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
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

  test('tap-flat', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
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

  test('junit', async () => {
    const { stdout } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
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

  test('github-actions', async () => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: ['github-actions'] },
    )

    expect(ctx).toBeDefined()

    expect(stdout).toMatchInlineSnapshot(`""`)
  })

  test('verbose non-tty', async () => {
    const { stdout, ctx } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: [['verbose', { isTTY: false }]] },
    )

    expect(
      stdout
        .replace(/\d+\.\d+\.\d+(-beta\.\d+)?/, '<version>')
        .replace(ctx!.config.root, '<root>')
        .replace(/\d+:\d+:\d+/, '<time>')
        .replace(/\d+(?:\.\d+)?m?s/g, '<duration>'),
    ).toMatchInlineSnapshot(`
      "
       RUN  v<version> <root>

       ✓ basic.test.ts > simple <duration>
       ✓ basic.test.ts > suite > second <duration>

       Test Files  1 passed (1)
            Tests  2 passed (2)
         Start at  <time>
         Duration  <duration> (transform <duration>, setup <duration>, import <duration>, tests <duration>, environment <duration>)

      "
    `)
  })

  test('default', async () => {
    const { stdout, stderr, ctx } = await runInlineTests(
      {
        'basic.test.ts': artifactsTest,
        'test-3.js': test3Content,
        'test-4.js': '',
      },
      { reporters: [['default', { isTTY: false }]] },
    )

    expect(
      stdout
        .replace(/\d+\.\d+\.\d+(-beta\.\d+)?/, '<version>')
        .replace(ctx!.config.root, '<root>')
        .replace(/\d+:\d+:\d+/, '<time>')
        .replace(/\d+(?:\.\d+)?m?s/g, '<duration>'),
    ).toMatchInlineSnapshot(`
      "
       RUN  v<version> <root>

       ✓ basic.test.ts (2 tests) <duration>

       Test Files  1 passed (1)
            Tests  2 passed (2)
         Start at  <time>
         Duration  <duration> (transform <duration>, setup <duration>, import <duration>, tests <duration>, environment <duration>)

      "
    `)
    expect(stderr).toMatchInlineSnapshot(`""`)
  })
})
