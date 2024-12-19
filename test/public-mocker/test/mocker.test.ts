import type { Browser } from 'playwright'
import type { UserConfig } from 'vite'
import { mockerPlugin } from '@vitest/mocker/node'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { beforeAll, expect, it, onTestFinished } from 'vitest'

let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
  return async () => {
    await browser.close()
    browser = null as any
  }
})

it('default server manual mocker works correctly', async () => {
  const { page } = await createTestServer({
    root: 'fixtures/manual-mock',
  })

  await expect.poll(() => page.locator('css=#mocked').textContent()).toBe('true')
})

it('automock works correctly', async () => {
  const { page } = await createTestServer({
    root: 'fixtures/automock',
  })

  await expect.poll(() => page.locator('css=#mocked').textContent()).toBe('42')
})

it('autospy works correctly', async () => {
  const { page } = await createTestServer({
    root: 'fixtures/autospy',
  })

  await expect.poll(() => page.locator('css=#mocked').textContent()).toBe('3, 42')
})

it('redirect works correctly', async () => {
  const { page } = await createTestServer({
    root: 'fixtures/redirect',
  })

  await expect.poll(() => page.locator('css=#mocked').textContent()).toBe('42')
})

async function createTestServer(config: UserConfig) {
  const server = await createServer({
    ...config,
    plugins: [
      mockerPlugin({
        globalThisAccessor: 'Symbol.for("vitest.mocker")',
        hoistMocks: {
          utilsObjectNames: ['mocker'],
          hoistedModule: 'virtual:mocker',
          hoistableMockMethodNames: ['customMock'],
          dynamicImportMockMethodNames: ['customMock'],
          hoistedMethodNames: ['customHoisted'],
        },
      }),
      {
        name: 'vi:resolver',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'virtual:mocker') {
            return id
          }
        },
        load(id) {
          if (id === 'virtual:mocker') {
            return `
import { registerModuleMocker } from '@vitest/mocker/register'
import { ModuleMockerServerInterceptor } from '@vitest/mocker/browser'

const _mocker = registerModuleMocker(
  () => new ModuleMockerServerInterceptor()
)

export const mocker = {
  customMock: _mocker.mock,
  customHoisted: _mocker.hoisted,
}
            `
          }
        },
      },
    ],
  })
  await server.listen()
  onTestFinished(async () => {
    await server.close()
  })
  const page = await browser.newPage()
  onTestFinished(async () => {
    await page.close()
  })
  await page.goto(server.resolvedUrls!.local[0])

  return {
    server,
    page,
  }
}
