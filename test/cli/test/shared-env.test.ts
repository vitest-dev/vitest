import { expect, test } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '../../test-utils'

test.each([
  1,
  2,
])('the environment is shared between tests with maxWorkers: %s', async (maxWorkers) => {
  const testCode = `
test('document is the same', () => {
  expect(__vitest_worker__.ctx.config.isolate).toBe(false)
  expect(__vitest_worker__.ctx.config.maxWorkers).toBe(${maxWorkers})
  expect(globalThis.__document ??= document).toBe(document)
})
    `
  const { stderr } = await runInlineTests({
    '1.test.js': testCode,
    '2.test.js': testCode,
    '3.test.js': testCode,
    '4.test.js': testCode,
    './setup.js': `
globalThis.__shared = true
    `,
    'vitest.config.js': {
      test: {
        environment: 'happy-dom',
        globals: true,
        isolate: false,
        setupFiles: ['./setup.js'],
      },
    },
  }, { sequence: { sequencer: StableTestFileOrderSorter }, maxWorkers })

  expect(stderr).toBe('')
})
