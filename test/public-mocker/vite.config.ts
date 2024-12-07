import { mockerPlugin } from '@vitest/mocker/node'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'fixtures/redirect',
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
