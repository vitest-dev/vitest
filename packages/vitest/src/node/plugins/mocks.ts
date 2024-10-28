import type { Plugin } from 'vite'
import { automockPlugin, hoistMocksPlugin } from '@vitest/mocker/node'
import { normalize } from 'pathe'
import { distDir } from '../../paths'
import { generateCodeFrame } from '../error'

export function MocksPlugins(): Plugin[] {
  const normalizedDistDir = normalize(distDir)
  return [
    hoistMocksPlugin({
      filter(id) {
        if (id.includes(normalizedDistDir)) {
          return false
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
