import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Plugin } from 'vite'
import sirv from 'sirv'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const VitestUIPlugin = (): Plugin => {
  return {
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      console.log(sirv(resolve(_dirname, '../dist/client')))

      server.middlewares.use('/', sirv(resolve(_dirname, '../dist/client'), {
        single: true,
        dev: true,
      }))
    },
  }
}
