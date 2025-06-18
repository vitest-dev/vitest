import { PassThrough } from 'node:stream'
import { noop } from '@vitest/utils'
import { expect, test, vi } from 'vitest'
import { registerConsoleShortcuts } from 'vitest/node'

test('pressing "b" restarts the browser server', async () => {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const ctx: any = {
    _initBrowserServers: vi.fn().mockResolvedValue(noop),
    projects: [
      { browser: { close: vi.fn().mockResolvedValue(noop) } },
      { browser: { close: vi.fn().mockResolvedValue(noop) } },
      { browser: { close: vi.fn().mockResolvedValue(noop) } },
      { browser: { close: vi.fn().mockResolvedValue(noop) } },
    ],
    logger: { log: noop, printBrowserBanner: noop },
    exit: noop,
  }

  const cleanup = registerConsoleShortcuts(ctx, stdin as any, stdout as any)
  stdin.emit('keypress', 'b', { name: 'b', ctrl: false, meta: false })
  await new Promise(process.nextTick)
  ctx.projects.forEach((project: any) => {
    expect(project.browser.close).toHaveBeenCalled()
  })
  expect(ctx._initBrowserServers).toHaveBeenCalled()

  cleanup()
})
