import type { Plugin } from 'vite'
import type { AutomockOptions } from './automock'
import { cleanUrl } from '../utils'
import { automockModule } from './automock'

export type { AutomockOptions as AutomockPluginOptions } from './automock'

export function automockPlugin(options: AutomockOptions = {}): Plugin {
  return {
    name: 'vitest:automock',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('mock=automock') || id.includes('mock=autospy')) {
        const mockType = id.includes('mock=automock') ? 'automock' : 'autospy'
        const ms = automockModule(code, mockType, this.parse, options)
        return {
          code: ms.toString(),
          map: ms.generateMap({ hires: 'boundary', source: cleanUrl(id) }),
        }
      }
    },
  }
}
