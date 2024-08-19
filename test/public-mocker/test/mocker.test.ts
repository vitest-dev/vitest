import { mockerPlugin } from '@vitest/mocker/node'
import { createServer } from 'vite'
import { expect, it, onTestFinished } from 'vitest'
import { chromium } from 'playwright'

it('default server mocker works correctly', async () => {
  const server = await createServer({
    root: 'fixtures/custom-mocker',
    plugins: [
      mockerPlugin({
        globalThisAccessor: 'Symbol.for("vitest.mocker")',
        hoistMocks: {
          utilsObjectNames: ['mocker'],
          regexpHoistable: /mocker.(customMock|customHoisted)/,
          hoistedModules: ['virtual:mocker'],
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
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(server.resolvedUrls!.local[0])
  onTestFinished(async () => {
    await server.close()
    await page.close()
    await browser.close()
  })

  await expect.poll(() => page.locator('css=#mocked').textContent()).toBe('true')
})
