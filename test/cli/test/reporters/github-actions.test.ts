import { randomUUID } from 'node:crypto'
import { access, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { sep } from 'node:path'
import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { GithubActionsReporter } from 'vitest/node'

describe(GithubActionsReporter, () => {
  it('uses absolute path by default', async () => {
    let { stdout, stderr } = await runVitest(
      { reporters: new GithubActionsReporter(), root: './fixtures/reporters', include: ['**/some-failing.test.ts'] },
    )
    stdout = stdout.replace(resolve(import.meta.dirname, '../..').replace(/:/g, '%3A'), '__TEST_DIR__')
    expect(stdout).toMatchInlineSnapshot(`
    "
    ::error file=__TEST_DIR__/fixtures/reporters/some-failing.test.ts,title=some-failing.test.ts > 3 + 3 = 7,line=8,column=17::AssertionError: expected 6 to be 7 // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- 7%0A+ 6%0A%0A ❯ some-failing.test.ts:8:17%0A%0A
    "
  `)
    expect(stderr).toBe('')
  })

  it('prints the project name when there is one', async () => {
    let { stdout, stderr } = await runVitest(
      {
        name: 'test-project',
        reporters: new GithubActionsReporter(),
        root: './fixtures/reporters',
        include: ['**/some-failing.test.ts'],
      },
    )
    stdout = stdout.replace(resolve(import.meta.dirname, '../..').replace(/:/g, '%3A'), '__TEST_DIR__')
    expect(stdout).toMatchInlineSnapshot(`
      "
      ::error file=__TEST_DIR__/fixtures/reporters/some-failing.test.ts,title=[test-project] some-failing.test.ts > 3 + 3 = 7,line=8,column=17::AssertionError: expected 6 to be 7 // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- 7%0A+ 6%0A%0A ❯ some-failing.test.ts:8:17%0A%0A
      "
    `)
    expect(stderr).toBe('')
  })

  it('uses onWritePath to format path', async () => {
    const { stdout, stderr } = await runVitest(
      {
        reporters: new GithubActionsReporter({
          onWritePath(path) {
            const normalized = path
              .replace(resolve(import.meta.dirname, '../..'), '')
              .replaceAll(sep, '/')

            return `/some-custom-path${normalized}`
          },
        }),
        root: './fixtures/reporters',
        include: ['**/some-failing.test.ts'],
      },
    )
    expect(stdout).toMatchInlineSnapshot(`
      "
      ::error file=/some-custom-path/fixtures/reporters/some-failing.test.ts,title=some-failing.test.ts > 3 + 3 = 7,line=8,column=17::AssertionError: expected 6 to be 7 // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- 7%0A+ 6%0A%0A ❯ some-failing.test.ts:8:17%0A%0A
      "
    `)
    expect(stderr).toBe('')
  })

  describe('summary', () => {
    it('writes one when enabled', async ({ onTestFinished }) => {
      const outputPath = resolve(tmpdir(), randomUUID())

      onTestFinished(async () => {
        await rm(outputPath).catch(() => {
          console.error(`Could not remove ${outputPath}`)
        })
      })

      const workspacePath = resolve(import.meta.dirname, '..', '..', '..', '..')

      await runVitest({
        reporters: new GithubActionsReporter({
          jobSummary: {
            outputPath,
            fileLinks: {
              commitHash: 'aaa',
              repository: 'owner/repo',
              workspacePath,
            },
          },
        }),
        root: './fixtures/reporters/github-actions',
      })

      const summary = await readFile(outputPath, 'utf8')

      expect(summary).toMatchInlineSnapshot(`
        "## Vitest Test Report

        **❌ 1 failed** | **✅ 9 passed** | 1 expected fail | 1 skipped | 1 todo | 13 total

        ### Flaky Tests

        These tests passed only after one or more retries, indicating potential instability.

        ##### \`flaky/math.spec.ts\` (5 flaky tests)

        - [\`should multiply numbers correctly\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/math.spec.ts) (**passed on retry 5 out of 5**)
        - [\`should handle edge cases\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/math.spec.ts) (**passed on retry 4 out of 5**)
        - [\`should validate input properly\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/math.spec.ts) (**passed on retry 4 out of 5**)
        - [\`should divide numbers correctly\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/math.spec.ts) (passed on retry 2 out of 5)
        - [\`should subtract numbers correctly\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/math.spec.ts) (passed on retry 1 out of 5)

        ##### \`flaky/network.spec.ts\` (3 flaky tests)

        - [\`network > should handle network timeouts gracefully\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/network.spec.ts) (**passed on retry 4 out of 4**)
        - [\`network > should fetch user data from API\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/network.spec.ts) (passed on retry 2 out of 3)
        - [\`network > should retry failed requests\`](https://github.com/owner/repo/blob/aaa/test/cli/fixtures/reporters/github-actions/flaky/network.spec.ts) (passed on retry 1 out of 3)
        "
      `)
    })

    it.for([{ enabled: false }, { outputPath: undefined }] as const)('does not write one when disabled or without `outputPath`', async (options) => {
      const outputPath = resolve(tmpdir(), randomUUID())

      const workspacePath = resolve(import.meta.dirname, '..', '..', '..', '..')

      await runVitest({
        reporters: new GithubActionsReporter({
          jobSummary: {
            outputPath,
            ...options,
            fileLinks: {
              commitHash: 'aaa',
              repository: 'owner/repo',
              workspacePath,
            },
          },
        }),
        root: './fixtures/reporters/github-actions',
      })

      const summary = await access(outputPath).then(() => true).catch(() => false)

      expect(summary).toBe(false)
    })

    it.for([
      { commitHash: undefined },
      { repository: undefined },
      { workspacePath: undefined },
    ] as const)('writes one without links when one of `commitHash`, `repository` or `workspacePath` are not provided', async (options, { onTestFinished }) => {
      const outputPath = resolve(tmpdir(), randomUUID())

      onTestFinished(async () => {
        await rm(outputPath).catch(() => {
          console.error(`Could not remove ${outputPath}`)
        })
      })

      const workspacePath = resolve(import.meta.dirname, '..', '..', '..', '..')

      await runVitest({
        reporters: new GithubActionsReporter({
          jobSummary: {
            outputPath,
            fileLinks: {
              commitHash: 'aaa',
              repository: 'owner/repo',
              workspacePath,
              ...options,
            },
          },
        }),
        root: './fixtures/reporters/github-actions',
      })

      const summary = await readFile(outputPath, 'utf8')

      expect(summary).toMatchInlineSnapshot(`
        "## Vitest Test Report

        **❌ 1 failed** | **✅ 9 passed** | 1 expected fail | 1 skipped | 1 todo | 13 total

        ### Flaky Tests

        These tests passed only after one or more retries, indicating potential instability.

        ##### \`flaky/math.spec.ts\` (5 flaky tests)

        - \`should multiply numbers correctly\` (**passed on retry 5 out of 5**)
        - \`should handle edge cases\` (**passed on retry 4 out of 5**)
        - \`should validate input properly\` (**passed on retry 4 out of 5**)
        - \`should divide numbers correctly\` (passed on retry 2 out of 5)
        - \`should subtract numbers correctly\` (passed on retry 1 out of 5)

        ##### \`flaky/network.spec.ts\` (3 flaky tests)

        - \`network > should handle network timeouts gracefully\` (**passed on retry 4 out of 4**)
        - \`network > should fetch user data from API\` (passed on retry 2 out of 3)
        - \`network > should retry failed requests\` (passed on retry 1 out of 3)
        "
      `)
    })
  })
})
