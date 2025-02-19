import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { GithubActionsReporter } from '../../../packages/vitest/src/node/reporters'
import { runVitest } from '../../test-utils'

test(GithubActionsReporter, async () => {
  let { stdout, stderr } = await runVitest(
    { reporters: new GithubActionsReporter(), root: './fixtures' },
    ['some-failing.test.ts'],
  )
  stdout = stdout.replace(resolve(__dirname, '..').replace(/:/g, '%3A'), '__TEST_DIR__')
  expect(stdout).toMatchInlineSnapshot(`
    "
    ::error file=__TEST_DIR__/fixtures/some-failing.test.ts,title=some-failing.test.ts > 3 + 3 = 7,line=8,column=17::AssertionError: expected 6 to be 7 // Object.is equality%0A%0A- Expected%0A+ Received%0A%0A- 7%0A+ 6%0A%0A ❯ some-failing.test.ts:8:17%0A%0A
    "
  `)
  expect(stderr).toBe('')
})
