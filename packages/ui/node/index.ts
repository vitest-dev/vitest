import { fileURLToPath } from 'url'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'

export default (base = '/__vitest__/', coverageFolder?: string) => {
  const coveragePath = coverageFolder ? `/${basename(coverageFolder)}/` : undefined
  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      const coverage = coverageFolder
        ? sirv(coverageFolder, { single: false, dev: true })
        : undefined
      const ui = sirv(clientDist, { single: true, dev: true })
      server.middlewares.use(base, async (req, res, next) => {
        const url = req.url
        if (coverage && url?.startsWith(coveragePath!))
          coverage?.(req, res, next)
        else
          ui(req, res, next)
      })
    },
  }
}
