import type { BrowserCommand } from 'vitest/node'

interface MarkTracePayload {
  name: string
  stack?: string
  selector?: string
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    /**
     * @internal
     */
    __vitest_markTrace: (payload: MarkTracePayload) => Promise<void>
  }
}

export const _markTrace: BrowserCommand<[payload: MarkTracePayload]> = async (
  context,
  payload,
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_markTrace', payload)
  }
}
