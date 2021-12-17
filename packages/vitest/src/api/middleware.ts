import type { ServerResponse } from 'http'
import type { Connect } from 'vite'
import { stringify } from 'flatted'
import { API_PATH } from '../constants'
import type { Vitest } from '../node'

export function sendFlatted(res: ServerResponse, data: any) {
  res.setHeader('Content-Type', 'application/json')
  res.write(stringify(data))
  res.statusCode = 200
  res.end()
}

export default function middlewareAPI(ctx: Vitest): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith(API_PATH))
      return next()

    const url = req.url.slice(API_PATH.length)

    if (url === '/') {
      return sendFlatted(res, {
        files: ctx.state.filesMap,
      })
    }

    if (url === '/files') {
      return sendFlatted(res, {
        files: Object.keys(ctx.state.filesMap),
      })
    }

    res.statusCode = 404
    res.end()
  }
}
