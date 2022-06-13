import type { Plugin as VitePlugin } from 'vite'
import { toArray } from '../../utils'
import type { Vitest } from '../core'

const cssLangs = '\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)'
const cssLangRE = new RegExp(cssLangs)

const isCSS = (id: string) => {
  return cssLangRE.test(id)
}

export function CSSEnablerPlugin(ctx: Vitest): VitePlugin {
  const skipProcessing = (id: string) => {
    if (!isCSS(id))
      return false
    const { css } = ctx.config
    if (typeof css === 'boolean')
      return !css
    if (toArray(css.exclude).some(re => re.test(id)))
      return true
    if (toArray(css.include).some(re => re.test(id)))
      return false
    return false
  }

  return {
    name: 'vitest:css-enabler',
    enforce: 'pre',
    transform(code, id) {
      if (skipProcessing(id))
        return ''
    },
  }
}
