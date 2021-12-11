import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Plugin } from 'vite'
import sirv from 'sirv'
import { getSuites } from '../../utils'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const VitestUIPlugin = (): Plugin => {
  return {
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      server.middlewares.use('/__vitest_api', async(req, res, next) => {
        const vitest = process.__vitest__

        const suites = getSuites(vitest.state.getFiles())
          .map(suite => ({
            id: suite.id,
            name: suite.name,
            type: suite.type,
            mode: suite.mode,
            result: suite.result,
          }))

        const info = {
          suites,
        }

        res.setHeader('Content-Type', 'application/json')
        res.write(JSON.stringify(info, null, 2))
        res.end()
      })

      server.middlewares.use('/', sirv(resolve(_dirname, '../dist/client'), {
        single: true,
        dev: true,
      }))
    },
  }
}
