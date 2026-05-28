import type { BrowserCommand } from 'vitest/node'
import type { BrowserServerCDPHandler } from '../cdp'

export const _startV8Coverage: BrowserCommand<[]> = async (context) => {
  const session: BrowserServerCDPHandler = await context.__ensureCDPHandler()
  await session.send('Profiler.enable')
  await session.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
}

export const _takeV8Coverage: BrowserCommand<[]> = async (context) => {
  const session: BrowserServerCDPHandler = await context.__ensureCDPHandler()
  return session.send('Profiler.takePreciseCoverage')
}
