import type { Plugin } from 'vite'
import { hoistMocks } from '../hoistMocks'
import { distDir } from '../../paths'

export function MocksPlugin(): Plugin {
  return {
    name: 'vitest:mocks',
    enforce: 'post',
    transform(code, id) {
      if (id.includes(distDir)) {
        return
      }
      return hoistMocks(code, id, this.parse)
    },
  }
}
