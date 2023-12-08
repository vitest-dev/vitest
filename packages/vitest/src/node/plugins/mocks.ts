import type { Plugin } from 'vite'
import { hoistMocks } from '../hoistMocks'

export function MocksPlugin(arg?: { always?: boolean }): Plugin {
  return {
    name: 'vitest:mocks',
    enforce: 'post',
    transform(code, id) {
      return hoistMocks(code, id, this.parse, arg?.always ?? false)
    },
  }
}
