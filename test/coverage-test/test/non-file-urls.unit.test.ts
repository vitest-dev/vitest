import type { CoverageMap } from '@vitest/istanbul-lib-coverage'
import { Writable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

// V8 can report scripts that have no file behind them, e.g. "about:" URLs from
// vitest-plugin-rsc, "data:" inline modules or "blob:" workers. Those used to
// crash the whole coverage run with ERR_INVALID_URL_SCHEME.
// See https://github.com/vitest-dev/vitest/issues/11036
test.each([
  'about:/React/Server/some-virtual-module',
  'data:text/javascript,export const a = 1',
  'blob:nodedata:0ac1a2e2-1b06-4b4a-9c6c-2ba1c0b3fd2f',
])('non-file url %s does not crash coverage conversion', async (url) => {
  const { convertCoverage } = await init()
  const file = resolve(import.meta.dirname, '../fixtures/src/even.ts')

  const coverageMap = await convertCoverage([
    { url, scriptId: '1', functions: [], startOffset: 0 },
    {
      url: pathToFileURL(file).href,
      scriptId: '2',
      startOffset: 0,
      functions: [
        {
          functionName: 'isEven',
          isBlockCoverage: true,
          ranges: [{ startOffset: 0, endOffset: 60, count: 1 }],
        },
      ],
    },
  ])

  // The file-backed script is still processed
  expect(coverageMap.files()).toContain(file)
})

async function init() {
  const vitest = await createVitest('test', {
    config: false,
    include: ['dont-match-anything'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['**/fixtures/src/**'],
      reporter: [],
    },
  }, {}, { stdout: new Writable() })

  onTestFinished(() => vitest.close())
  await vitest.standalone()

  const provider = vitest.coverageProvider as any

  return {
    convertCoverage: (result: unknown[]): Promise<CoverageMap> =>
      provider.convertCoverage({ result }, vitest.getRootProject(), 'ssr'),
  }
}
