import type { Plugin } from 'vite'
import { automockPlugin, hoistMocksPlugin } from '@vitest/mocker/node'
import { distDir } from '../../paths'
import { generateCodeFrame } from '../error'

export interface MocksPluginOptions {
  filter?: (id: string) => boolean
}

export function MocksPlugins(options: MocksPluginOptions = {}): Plugin[] {
  return [
    hoistMocksPlugin({
      filter(id) {
        if (id.includes(distDir)) {
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
    }),
    automockPlugin(),
  ]
}
