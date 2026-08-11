import type { BrowserCommandContext } from 'vitest/node'
import { describe, expect, test, vi } from 'vitest'
import { screenshot } from '../../../packages/browser/src/node/commands/screenshot'

function createContext() {
  return {
    testPath: '/project/tests/foo.test.ts',
    project: {
      config: {
        root: '/project',
        attachmentsDir: '/project/.vitest/attachments',
      },
    },
    triggerCommand: vi.fn(async () => ({
      buffer: Buffer.from('x'),
      path: '/project/tests/__screenshots__/foo.test.ts/failing-test-1.png',
    })),
  }
}

describe('failure screenshots', () => {
  test('are stored in the attachments directory, not in __screenshots__', async () => {
    const context = createContext()

    await screenshot(
      context as unknown as BrowserCommandContext,
      'failing-test-1.png',
      { timeout: 5000, internal: 'failure-screenshot' } as any,
    )

    expect(context.triggerCommand).toHaveBeenCalledWith(
      '__vitest_takeScreenshot',
      'failing-test-1.png',
      expect.objectContaining({
        path: '/project/.vitest/attachments/failing-test-1.png',
      }),
    )
  })

  test('do not change the default path of regular screenshots', async () => {
    const context = createContext()

    await screenshot(
      context as unknown as BrowserCommandContext,
      'regular-screenshot-1.png',
      { timeout: 5000 } as any,
    )

    expect(context.triggerCommand).not.toHaveBeenCalledWith(
      '__vitest_takeScreenshot',
      'regular-screenshot-1.png',
      expect.objectContaining({ path: expect.any(String) }),
    )
  })
})
