import { resolve } from 'pathe'
import { it } from 'vitest'
import { runVitest } from '../../test-utils'

const _options = { root: 'fixtures', watch: true }

it('should restart browser server', async () => {
  const { vitest, ctx } = await runVitest(_options, ['math'])
  const ctx2 = ctx as any

  ctx2._initBrowserServers = async () => {
    ctx2.projects.forEach((project: any) => {
      project.browser = {
        close: async () => {},
        vite: {
          resolvedUrls: {
            local: ['http://localhost:3000'],
            network: ['http://localhost:3000'],
          },
        } as any,
        provider: { name: 'chromium' } as any,
      }
    })
  }

  vitest.write('r')
  await vitest.waitForStdout('RERUN')
  vitest.write('b')
  await vitest.waitForStdout('Browser runner started')
})

it('should restart multiple browser servers', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const { vitest, ctx } = await runVitest({ root, watch: true })
  const ctx2 = ctx as any

  ctx2._initBrowserServers = async () => {
    ctx2.projects.forEach((project: any) => {
      project.browser = {
        close: async () => {},
        vite: {
          resolvedUrls: {
            local: ['http://localhost:3000'],
            network: ['http://localhost:3000'],
          },
        } as any,
        provider: { name: 'chromium' } as any,
      }
    })
  }

  vitest.write('b')
  for (let i = 0; i < ctx2.projects.length; i++) {
    await vitest.waitForStdout('Browser runner started')
  }
})
