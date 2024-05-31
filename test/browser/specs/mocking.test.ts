import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.each([true, false])('mocking works correctly - isolated %s', async (isolate) => {
  const result = await runVitest({
    root: 'fixtures/mocking',
    isolate,
  })
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('automocked.test.ts')
  expect(result.stdout).toContain('mocked-__mocks__.test.ts')
  expect(result.stdout).toContain('mocked-factory.test.ts')
  expect(result.stdout).toContain('mocked-factory-hoisted.test.ts')
  expect(result.stdout).toContain('not-mocked.test.ts')
  expect(result.stdout).toContain('mocked-nested.test.ts')
  expect(result.stdout).toContain('not-mocked-nested.test.ts')
  expect(result.stdout).toContain('import-actual-in-mock.test.ts')
  expect(result.stdout).toContain('import-actual-query.test.ts')
  expect(result.stdout).toContain('import-mock.test.ts')
  expect(result.exitCode).toBe(0)
})
