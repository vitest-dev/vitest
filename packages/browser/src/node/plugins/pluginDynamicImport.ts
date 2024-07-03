import type { Plugin } from 'vite'
import { injectDynamicImport } from '../esmInjector'

const regexDynamicImport = /import\s*\(/

export default (): Plugin => {
  return {
    name: 'vitest:browser:esm-injector',
    enforce: 'post',
    transform(source, id) {
      // TODO: test is not called for static imports
      if (!regexDynamicImport.test(source)) {
        return
      }
      return injectDynamicImport(source, id, this.parse)
    },
  }
}
