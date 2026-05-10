import type { BrowserCommand } from 'vitest/node'
import { traceDbg } from '../dbg'

export const logTraceDbg: BrowserCommand<[{ msg: string }]> = (_ctx, { msg }) => {
  traceDbg(msg)
}
