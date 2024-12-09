import type { Connect } from 'vite'
import type { BrowserServer } from '../server'
import { resolveOrchestrator } from '../serverOrchestrator'
import { allowIframes, disableCache } from './utils'

export function createOrchestratorMiddleware(browserServer: BrowserServer): Connect.NextHandleFunction {
  return async function vitestOrchestratorMiddleware(req, res, next) {
    if (!req.url) {
      return next()
    }
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== browserServer.base) {
      return next()
    }

    disableCache(res)
    allowIframes(res)

    const html = await resolveOrchestrator(browserServer, url, res)
    res.write(html, 'utf-8')
    res.end()
  }
}
