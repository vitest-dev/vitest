import { expect, test } from 'vitest'
import { resolve } from 'pathe'
import { runVitest } from '../../test-utils'

test('should print function name', async () => {
  const filename = resolve('./fixtures/test/example.test.ts')
  const { stderr } = await runVitest({ root: './fixtures' }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('FAIL  test/example.test.ts > foo > Bar')
  expect(stderr).toContain('FAIL  test/example.test.ts > Bar > foo')
  expect(stderr).toContain('FAIL  test/example.test.ts > foo > foo')
  expect(stderr).toContain('FAIL  test/example.test.ts > Bar > Bar')
})
