import type { Plugin as VitePlugin } from 'vite'
import { toArray } from '../../utils'
import type { Vitest } from '../core'

const cssLangs = '\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)'
const cssLangRE = new RegExp(cssLangs)
const cssModuleRE = new RegExp(`\\.module${cssLangs}`)

const isCSS = (id: string) => {
  return cssLangRE.test(id)
}

const isCSSModule = (id: string) => {
  return cssModuleRE.test(id)
}

export function CSSEnablerPlugin(ctx: Vitest): VitePlugin {
  const shouldProcessCSS = (id: string) => {
    const { css } = ctx.config
    if (typeof css === 'boolean')
      return css
    if (toArray(css.exclude).some(re => re.test(id)))
      return false
    if (toArray(css.include).some(re => re.test(id)))
      return true
    return false
  }

  const shouldReturnProxy = (id: string) => {
    const { css } = ctx.config
    if (typeof css === 'boolean')
      return css
    if (!isCSSModule(id))
      return false
    return !css.modules?.mangleClassName
  }

  return {
    name: 'vitest:css-enabler',
    enforce: 'pre',
    transform(code, id) {
      if (!isCSS(id))
        return
      if (!shouldProcessCSS(id)) {
        return { code: '' }
      }
      else if (shouldReturnProxy(id)) {
        // TODO parse and check if object actually exists
        const code = `export default new Proxy(Object.create(null), {
          get(_, style) {
            return style;
          },
        })`
        return { code }
      }
    },
  }
}
