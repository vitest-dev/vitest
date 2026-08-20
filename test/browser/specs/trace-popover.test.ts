import type { BrowserTraceData } from '../../../packages/browser/src/client/tester/trace'
import { expect, test } from 'vitest'
import { buildTestProjectTree } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

test('trace captures open popovers', async () => {
  const { results } = await runBrowserTests({
    root: './fixtures/trace-popover',
  })

  const projectTree = buildTestProjectTree(results, (testCase) => {
    const entries = testCase.artifacts().flatMap((artifact) => {
      return artifact.type === 'internal:browserTrace'
        ? (artifact.data as BrowserTraceData).entries
        : []
    })
    return entries.find(entry => entry.name === 'popover is open')?.snapshot.popoverIds
  })

  for (const { browser } of instances) {
    expect(projectTree[browser]).toEqual({
      'popover.test.ts': {
        'captures an open popover': [expect.any(Number)],
      },
    })
  }
})
