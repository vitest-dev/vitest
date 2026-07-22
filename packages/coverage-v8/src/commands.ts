import type { CDPSession } from '@vitest/browser-playwright'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

export const commands: Record<string, BrowserCommand> = {
  startV8Coverage,
  takeV8Coverage,
}

async function startV8Coverage(context: BrowserCommandContext): Promise<void> {
  const session: CDPSession = await context.__ensureCDPHandler()
  await session.send('Profiler.enable')
  await session.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
}

async function takeV8Coverage(context: BrowserCommandContext): Promise<any> {
  const session: CDPSession = await context.__ensureCDPHandler()
  return session.send('Profiler.takePreciseCoverage')
}
