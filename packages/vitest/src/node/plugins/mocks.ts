import type { Plugin } from 'vite'
import { hoistMocks } from '../hoistMocks'

export function MocksPlugin(): Plugin {
  return {
    name: 'vitest:mocks',
    enforce: 'post',
    transform: {
      order: 'post', // ensure it always runs
      handler(code, id) {
        return hoistMocks(code, id, this.parse)
      },
    },
  }
}
