import { fileURLToPath } from 'url'
import { resolve } from 'pathe'
import sirv from 'sirv'

import type { Plugin } from 'vite'
import type { Vitest } from 'vitest/node'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const VitestUIPlugin = (vitest: Vitest): Plugin => {
  return {
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      server.middlewares.use('/', sirv(clientDist, {
        single: true,
        dev: true,
      }))
    },
  } as Plugin
}
