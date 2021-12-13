import type { ServerResponse } from 'http'
import type { Connect } from 'vite'
import { API_PATH } from '../constants'

export function sendJSON(res: ServerResponse, data: any) {
  res.setHeader('Content-Type', 'application/json')
  res.write(JSON.stringify(data))
  res.statusCode = 200
  res.end()
}

export default function middlewareAPI(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith(API_PATH))
      return next()

    const url = req.url.slice(API_PATH.length)
    const ctx = process.__vitest__

    if (url === '/') {
      return sendJSON(res, {
        // files: ctx.state.filesMap,
      })
    }

    if (url === '/files') {
      return sendJSON(res, {
        files: Object.keys(ctx.state.filesMap),
      })
    }

    res.statusCode = 404
    res.end()
  }
}
