import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

test('should still test math.test.ts', async () => {
  const { stderr, stdout } = await runVitest({
    config: 'fixtures/exclude/vitest.exclude.config.ts',
    exclude: ['fixtures/exclude/string.test.ts'],
  })

  expect(stdout).toContain(`✓ fixtures/exclude/math.test.ts`)
  expect(stdout).not.toContain(`string.test.ts`)
  expect(stderr).toBe('')
})

test.each([
  ['project sets exclude', {}, { exclude: ['**/node_modules/**'] }],
  ['root sets exclude', { exclude: ['**/node_modules/**'] }, {}],
])('--exclude applies to inline projects when %s', async (_, root, project) => {
  const { stderr, testTree } = await runInlineTests(
    {
      'basic.test.ts': `test('basic', () => {})`,
      'basic.integration.test.ts': `test('integration', () => {})`,
    },
    {
      globals: true,
      ...root,
      cliExclude: ['**/*.integration.test.*'],
      projects: [
        { extends: true, test: { name: 'unit', ...project } },
        { extends: true, test: { name: 'other' } },
      ],
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
})
