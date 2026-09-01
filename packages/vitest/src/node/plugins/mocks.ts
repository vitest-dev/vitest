import type { Plugin } from 'vite'
import { automockPlugin, hoistMocksPlugin } from '@vitest/mocker/node'
import { normalize } from 'pathe'
import { distDir } from '../../paths'
import { generateCodeFrame } from '../printError'

export interface MocksPluginOptions {
  filter?: (id: string) => boolean
}

export function MocksPlugins(options: MocksPluginOptions = {}): Plugin[] {
  const normalizedDistDir = normalize(distDir)
  return [
    {
      name: 'vitest:mocks',
      enforce: 'post',
      applyToEnvironment(environment) {
        return hoistMocksPlugin({
          root: environment.config.root,
          // Use the same gate as Vite's SSR transform, including emulated DOM environments.
          renderExport: environment.config.dev.moduleRunnerTransform
            ? (name, expression) => `__vite_ssr_exportName__(${JSON.stringify(name)}, () => { try { return ${expression} } catch {} });\n`
            : undefined,
          filter(id) {
            if (id.includes(normalizedDistDir)) {
              return false
            }
            if (options.filter) {
              return options.filter(id)
            }
            return true
          },
          codeFrameGenerator(node, id, code) {
            return generateCodeFrame(
              code,
              4,
              node.start + 1,
            )
          },
        })
      },
    },
    automockPlugin(),
  ]
}
