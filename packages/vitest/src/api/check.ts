import type { IncomingMessage } from 'node:http'
import type { ResolvedConfig } from '../node/types/config'
import crypto from 'node:crypto'

export function isValidApiRequest(config: ResolvedConfig, req: IncomingMessage): boolean {
  const url = new URL(req.url ?? '', 'http://localhost')

  // validate token. token is injected in ui/tester/orchestrator html, which is cross origin proteced.
  try {
    const token = url.searchParams.get('token')
    if (token && crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(config.api.token),
    )) {
      return true
    }
  }
  // an error is thrown when the length is incorrect
  catch {}

  return false
}
