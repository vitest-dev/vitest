import { fileURLToPath } from 'url'
import { resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'

export default (base = '/') => {
  return <Plugin>{
    name: 'vitest:web',
    apply: 'serve',
    async configureServer(server) {
      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      server.middlewares.use(base, sirv(clientDist, {
        single: true,
        dev: true,
      }))
    },
  }
}
