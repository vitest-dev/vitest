import type { Connect } from 'vite'
import type { ParentBrowserProject } from '../projectParent'
import { resolveOrchestrator } from '../serverOrchestrator'
import { allowIframes, disableCache } from './utils'

export function createOrchestratorMiddleware(parentServer: ParentBrowserProject): Connect.NextHandleFunction {
  return async function vitestOrchestratorMiddleware(req, res, next) {
    if (!req.url) {
      return next()
    }
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== parentServer.base) {
      return next()
    }

    const html = await resolveOrchestrator(parentServer, url, res)
    if (html) {
      disableCache(res)
      allowIframes(res)

      res.write(html, 'utf-8')
      res.end()
    }
  }
}
