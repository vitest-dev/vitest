import { relative } from 'pathe'
import type { Plugin as VitePlugin } from 'vite'
import { generateCssFilenameHash } from '../../integrations/css/css-modules'
import type { CSSModuleScopeStrategy } from '../../types'
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

const getCSSModuleProxyReturn = (strategy: CSSModuleScopeStrategy, filename: string) => {
  if (strategy === 'non-scoped')
    return 'style'
  const hash = generateCssFilenameHash(filename)
  return `\`_\${style}_${hash}\``
}

export function CSSEnablerPlugin(ctx: Vitest): VitePlugin[] {
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

  return [
    {
      name: 'vitest:css-disable',
      enforce: 'pre',
      transform(code, id) {
        if (!isCSS(id))
          return
        // css plugin inside Vite won't do anything if the code is empty
        // but it will put __vite__updateStyle anyway
        if (!shouldProcessCSS(id))
          return { code: '' }
      },
    },
    {
      name: 'vitest:css-empty-post',
      enforce: 'post',
      transform(_, id) {
        if (!isCSS(id) || shouldProcessCSS(id))
          return

        if (isCSSModule(id)) {
          // return proxy for css modules, so that imported module has names:
          // styles.foo returns a "foo" instead of "undefined"
          // we don't use code content to generate hash for "scoped", because it's empty
          const scopeStrategy = (typeof ctx.config.css !== 'boolean' && ctx.config.css.modules?.classNameStrategy) || 'stable'
          const proxyReturn = getCSSModuleProxyReturn(scopeStrategy, relative(ctx.config.root, id))
          const code = `export default new Proxy(Object.create(null), {
            get(_, style) {
              return ${proxyReturn};
            },
          })`
          return { code }
        }

        return { code: '' }
      },
    },
  ]
}
