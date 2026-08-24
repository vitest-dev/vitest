import type { Page } from 'playwright'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import { onTestFinished, recordArtifact, test } from 'vitest'

const require = createRequire(import.meta.url)
const rrwebSnapshotPath = require.resolve('rrweb-snapshot')

test('custom trace', async ({ task }) => {
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())

  const page = await browser.newPage()
  await page.setContent('<main><button>Before action</button></main>')
  await page.addScriptTag({ path: rrwebSnapshotPath })

  await recordTrace(page, task, 'before action', 0)

  await page.locator('main').evaluate((element) => {
    element.innerHTML = '<button>After action</button>'
  })
  await recordTrace(page, task, 'after action', 1)
})

async function recordTrace(page: Page, task: Parameters<typeof recordArtifact>[0], name: string, startTime: number) {
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
        startTime,
        snapshot,
      }],
    },
  })
}
