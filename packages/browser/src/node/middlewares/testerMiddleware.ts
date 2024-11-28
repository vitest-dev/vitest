import type { Connect } from 'vite'
import type { BrowserServer } from '../server'
import { resolveTester } from '../serverTester'
import { allowIframes, disableCache } from './utils'

export function createTesterMiddleware(browserServer: BrowserServer): Connect.NextHandleFunction {
  return async function vitestTesterMiddleware(req, res, next) {
    if (!req.url) {
      return next()
    }
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith(browserServer.prefixTesterUrl)) {
      return next()
    }

    disableCache(res)
    allowIframes(res)

    const html = await resolveTester(browserServer, url, res, next)
    if (html) {
      res.write(html, 'utf-8')
      res.end()
    }
  }
}
