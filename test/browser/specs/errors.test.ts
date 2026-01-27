import { expect, test } from 'vitest'
import { instances, runBrowserTests, runInlineBrowserTests } from './utils'

test('prints correct unhandled error stack', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
  })

  expect(stderr).toContain('throw-unhandled-error.test.ts:9:10')
  expect(stderr).toContain('This error originated in "throw-unhandled-error.test.ts" test file.')
  expect(stderr).toContain('The latest test that might\'ve caused the error is "unhandled exception".')

  if (instances.some(({ browser }) => browser === 'webkit')) {
    expect(stderr).toContain('throw-unhandled-error.test.ts:9:20')
  }
})

test('ignores unhandled errors', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
    onUnhandledError(error) {
      if (error.message.includes('custom_unhandled_error')) {
        return false
      }
    },
  })

  expect(stderr).toBe('')
})

test('disables tracking', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
    browser: {
      trackUnhandledErrors: false,
    },
  })
  expect(stderr).toBe('')
})

test('print unhandled non error', async () => {
  const { testTree, stderr } = await runBrowserTests({
    root: './fixtures/unhandled-non-error',
  })
  expect(stderr).toContain('[Error: ResizeObserver loop completed with undelivered notifications.]')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "ResizeObserver error": "passed",
      },
    }
  `)
})

test('throws an error if test reloads the iframe during a test run', async () => {
  const { stderr, fs } = await runInlineBrowserTests({
    'iframe-reload.test.ts': `
      import { test } from 'vitest';

      test('reload iframe', () => {
        location.reload();
      });
    `,
  })
  expect(stderr).toContain(
    `The iframe for "${fs.resolveFile('./iframe-reload.test.ts')}" was reloaded during a test.`,
  )
})

// TODO: confirm snapshots don't work with exec: false
test.only('cannot use fs commands if write is disabled', async () => {
  const { stderr, fs } = await runInlineBrowserTests({
    'fs-commands.test.ts': `
      import { test, expect, recordArtifact } from 'vitest'
      import { commands } from 'vitest/browser'

      test.describe('fs security', () => {
        test('fs writeFile throws an error', async () => {
          await commands.writeFile('/test-file.txt', 'Hello World')
        })

        test('fs removeFile throws an error', async () => {
          await commands.removeFile('/test-file.txt')
        })

        test('doesnt write attachment to disk', async ({ annotate }) => {
          await annotate('test-attachment', { data: 'Test Attachment', path: '/test-attachment.txt' })
        })

        test('cannot record attachments inside artifact', async ({ task }) => {
          await recordArtifact(task, {
            attachments: [{ data: 'Artifact Attachment', path: '/artifact-attachment.txt' }],
            type: 'my-custom',
          })
        })

        test('snapshot saves are not saved', () => {
          expect('snapshot content').toMatchSnapshot()
        })
      })
    `,
    './__snapshots__/basic.test.js.snap': `// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html`,
    'basic.test.js': `
      import { test } from 'vitest'

      test('basic test', () => {
        expect(1 + 1).toBe(2)
      })
    `,
  }, {
    browser: {
      api: {
        allowExec: false,
        allowWrite: false,
      },
    },
    $cliOptions: {
      update: true,
    },
  })

  const errors = stderr.split('\n').filter(line => line.includes('Cannot modify file "/test-file.txt".'))
  expect(errors).toHaveLength(2 * instances.length)

  expect(stderr).toContain(
    `Cannot save snapshot file "${fs.resolveFile('./__snapshots__/fs-commands.test.ts.snap')}". File writing is disabled because server is exposed to the internet`,
  )
  expect(stderr).toContain(
    `Cannot remove snapshot file "${fs.resolveFile('./__snapshots__/basic.test.js.snap')}". File writing is disabled because server is exposed to the internet`,
  )

  // we don't throw an error if cannot write attachment, just warn
  expect(stderr).toContain(
    'Cannot record annotation attachment because file writing is disabled',
  )
  expect(stderr).toContain(
    'Cannot record attachments ("/artifact-attachment.txt") because file writing is disabled, removing attachments from artifact "my-custom".',
  )
})
