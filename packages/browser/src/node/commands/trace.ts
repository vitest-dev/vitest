import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

declare module 'vitest/browser' {
  interface BrowserCommands {
    /**
     * @internal
     */
    __vitest_markTrace: (name: string, stack?: string) => Promise<void>
  }
}

export const markTrace = (async (
  context: BrowserCommandContext,
  name: string,
  stack?: string,
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_markTrace', name, stack)
  }
}) as BrowserCommand<[name: string]>
