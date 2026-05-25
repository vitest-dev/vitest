import type { BrowserCommand } from 'vitest/node'

export const _startV8Coverage: BrowserCommand<[]> = async (context) => {
  const session = await context.__ensureCDPHandler()
  await session.send('Profiler.enable')
  await session.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
}

export const _takeV8Coverage: BrowserCommand<[]> = async (context) => {
  const session = await context.__ensureCDPHandler()
  return session.send('Profiler.takePreciseCoverage')
}
