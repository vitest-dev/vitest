import type { BaseCoverageProvider, CoverageOptions } from 'vitest/node'
import { Writable } from 'node:stream'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

test('convertCoverage skips non-file: URLs without throwing', async () => {
  const provider = await init({ include: ['**/*.ts'] })

  // Coverage entries whose URL is not a `file:` URL (e.g. `about:/…` injected
  // by RSC virtual modules, `data:` inline modules, `blob:` workers). Without
  // the guard around `fileURLToPath`, this would throw `ERR_INVALID_URL_SCHEME`
  // and abort the entire coverage run.
  const rawCoverage = {
    result: [
      { url: 'about:/React/Server/fake.js', functions: [], scriptId: '1' },
      { url: 'data:text/javascript,console.log(1)', functions: [], scriptId: '2' },
      { url: 'blob:https://example.com/abc', functions: [], scriptId: '3' },
      { url: 'not-a-url', functions: [], scriptId: '4' },
    ],
  }

  const rootProject = (provider as any).ctx.getRootProject()

  await expect(
    (provider as any).convertCoverage(rawCoverage, rootProject, 'ssr'),
  ).resolves.toBeDefined()
})

async function init(options: Partial<CoverageOptions>) {
  const vitest = await createVitest('test', {
    config: false,
    include: ['dont-match-anything'],
    coverage: {
      ...options,
      enabled: true,
      provider: 'v8',
    },
  }, {}, { stdout: new Writable() })

  onTestFinished(() => vitest.close())
  await vitest.standalone()

  return vitest.coverageProvider as unknown as BaseCoverageProvider
}
