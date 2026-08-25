import type { Page } from 'playwright'
import { createRequire } from 'node:module'
import { recordArtifact, vi } from 'vitest'

const require = createRequire(import.meta.url)
const rrwebSnapshotPath = require.resolve('rrweb-snapshot')

export async function createTraceRecorder(page: Page, task: Parameters<typeof recordArtifact>[0]) {
  await page.addScriptTag({ path: rrwebSnapshotPath })
  const startTime = performance.now()

  return {
    snapshot: vi.defineHelper(async (name: string) => {
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
          retry: 0,
          repeats: 0,
          recordCanvas: false,
          entries: [{
            name,
            kind: 'mark',
            startTime: performance.now() - startTime,
            snapshot,
          }],
        },
      })
    }),
  }
}
