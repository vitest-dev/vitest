import type { ServerResponse } from 'node:http'

export function disableCache(res: ServerResponse) {
  res.setHeader(
    'Cache-Control',
    'no-cache, max-age=0, must-revalidate',
  )
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
}

export function allowIframes(res: ServerResponse) {
  // remove custom iframe related headers to allow the iframe to load
  res.removeHeader('X-Frame-Options')
}
