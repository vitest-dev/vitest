import type { Page } from 'playwright'
import type { TestContext } from 'vitest'
import { createRequire } from 'node:module'
import { recordArtifact, vi } from 'vitest'

const require = createRequire(import.meta.url)
const rrwebSnapshotPath = require.resolve('rrweb-snapshot')

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
}

export async function createTraceRecorder(
  page: Page,
  task: TestContext['task'],
  attempt: TraceAttempt,
) {
  await page.addScriptTag({ path: rrwebSnapshotPath })

  return {
    snapshot: vi.defineHelper(async (name: string) => {
      const startTime = performance.now() - attempt.startTime
      const snapshot = await page.evaluate(() => {
        const { snapshot } = (globalThis as any).rrwebSnapshot
        const serialized = snapshot(document)
        if (!serialized) {
          throw new Error('Failed to serialize document')
        }
        return {
          serialized,
          viewport: {
            width: globalThis.innerWidth,
            height: globalThis.innerHeight,
          },
          scroll: {
            x: globalThis.scrollX,
            y: globalThis.scrollY,
          },
          pseudoClassIds: {},
        }
      })

      await recordArtifact(task, {
        type: 'internal:browserTrace',
        data: {
          retry: attempt.retry,
          repeats: attempt.repeats,
          recordCanvas: false,
          entries: [{
            name,
            kind: 'mark',
            startTime,
            snapshot,
          }],
        },
      })
    }),
  }
}
