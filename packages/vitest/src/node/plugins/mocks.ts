import type { Plugin } from 'vite'
import { hoistMocks } from '../hoistMocks'

export function MocksPlugin(): Plugin {
  return {
    name: 'vite:mocks',
    enforce: 'post',
    transform(code, id) {
      return hoistMocks(code, id, this.parse)
    },
  }
}
