import type { Plugin } from 'vite'
import { basename } from 'pathe'
import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

const versionedRequestRegexp = /[?&]v=\w{8}/

function recordDependencyResponses() {
  const responses: { kind: 'chunk' | 'entry'; cacheControl: string }[] = []
  const plugin: Plugin = {
    name: 'record-dependency-responses',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.on('finish', () => {
          if (!req.url || !versionedRequestRegexp.test(req.url)) {
            return
          }
          const chunks = server.environments.client.depsOptimizer?.metadata.chunks ?? {}
          const chunkFiles = new Set(Object.values(chunks).map((chunk) => basename(chunk.file)))
          const file = basename(new URL(req.url, 'http://localhost').pathname)
          responses.push({
            kind: chunkFiles.has(file) ? 'chunk' : 'entry',
            cacheControl: String(res.getHeader('cache-control')),
          })
        })
        next()
      })
    },
  }
  return { plugin, responses }
}

function summarize(responses: { kind: string; cacheControl: string }[]) {
  const summary: Record<string, string[]> = {}
  for (const { kind, cacheControl } of responses) {
    const values = (summary[kind] ??= [])
    if (!values.includes(cacheControl)) {
      values.push(cacheControl)
    }
  }
  return summary
}

test('shared optimizer chunks keep immutable caching when mocks are served by request interception', async () => {
  const { plugin, responses } = recordDependencyResponses()
  const { stderr } = await runBrowserTests(
    {
      root: './fixtures/optimized-chunks-cache',
      browser: { importMapMocks: false },
    },
    undefined,
    { plugins: [plugin] },
  )

  expect(stderr).toReportNoErrors()
  expect(summarize(responses)).toMatchInlineSnapshot(`
    {
      "chunk": [
        "max-age=31536000,immutable",
      ],
      "entry": [
        "no-cache",
      ],
    }
  `)
})
