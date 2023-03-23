import { fileURLToPath } from 'url'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'

export default (base = '/__vitest__/', resolveCoverageFolder?: () => string | undefined) => {
  let coveragePath: string | undefined
  let coverageFolder: string | undefined
  return <Plugin>{
    name: 'vitest:ui',
    apply: 'serve',
    configResolved() {
      coverageFolder = resolveCoverageFolder?.() ?? undefined
      coveragePath = coverageFolder ? `/${basename(coverageFolder)}/` : undefined
      if (coveragePath && base === coveragePath)
        throw new Error(`The base path and the coverage path cannot be the same: ${base}`)
    },
    async configureServer(server) {
      coverageFolder && server.middlewares.use(coveragePath!, sirv(coverageFolder, {
        single: true,
        dev: true,
      }))
      const clientDist = resolve(fileURLToPath(import.meta.url), '../client')
      server.middlewares.use(base, sirv(clientDist, {
        single: true,
        dev: true,
      }))
    },
  }
}
