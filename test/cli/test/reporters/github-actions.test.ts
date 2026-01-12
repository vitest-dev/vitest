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
})
