import { expect, test } from 'vitest'
import { resolve } from 'pathe'
import { runVitest } from '../../test-utils'

test('should print function name', async () => {
  const filename = resolve('./fixtures/custom-diff-options.test.ts')
  const diff = resolve('./fixtures/custom-diff-options.ts')
  const { stderr } = await runVitest({ root: './fixtures', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('function-as-name.test.ts > foo > Bar')
})
