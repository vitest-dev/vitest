import type { Plugin as VitePlugin } from 'vite'
import type { Vitest } from '../core'

const isCss = (id: string) => {
  return /\.(css|styl|less|sass|scss)$/.test(id)
}

export function CSSEnablerPlugin(ctx: Vitest): VitePlugin {
  const shouldProcess = (id: string) => {
    if (!isCss(id))
      return true
    const { processCss } = ctx.config
    if (typeof processCss === 'boolean')
      return processCss
    return processCss.some(re => re.test(id))
  }

  return {
    name: 'vitest:css-enabler',
    enforce: 'pre',
    transform(code, id) {
      if (!shouldProcess(id))
        return ''
    },
  }
}
