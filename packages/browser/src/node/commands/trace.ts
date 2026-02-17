import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

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

export const markTrace = (async (
  context: BrowserCommandContext,
  payload: { name: string; selector?: string; stack?: string },
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_markTrace', payload)
  }
}) as BrowserCommand<[payload: { name: string; selector?: string; stack?: string }]>
