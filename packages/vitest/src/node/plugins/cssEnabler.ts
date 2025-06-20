import type { Plugin as VitePlugin } from 'vite'
import type { CSSModuleScopeStrategy, ResolvedConfig } from '../types/config'
import { toArray } from '@vitest/utils'
import { relative } from 'pathe'
import { generateCssFilenameHash } from '../../integrations/css/css-modules'

const cssLangs = '\\.(?:css|less|sass|scss|styl|stylus|pcss|postcss)(?:$|\\?)'
const cssLangRE = new RegExp(cssLangs)
const cssModuleRE = new RegExp(`\\.module${cssLangs}`)
const cssInlineRE = /[?&]inline(?:&|$)/

function isCSS(id: string) {
  return cssLangRE.test(id)
}

function isCSSModule(id: string) {
  return cssModuleRE.test(id)
}

// inline css requests are expected to just return the
// string content directly and not the proxy module
function isInline(id: string) {
  return cssInlineRE.test(id)
}

function getCSSModuleProxyReturn(
  strategy: CSSModuleScopeStrategy,
  filename: string,
) {
  if (strategy === 'non-scoped') {
    return 'style'
  }
  const hash = generateCssFilenameHash(filename)
  return `\`_\${style}_${hash}\``
}

export function CSSEnablerPlugin(ctx: {
  config: ResolvedConfig
}): VitePlugin[] {
  const shouldProcessCSS = (id: string) => {
    const { css } = ctx.config
    if (typeof css === 'boolean') {
      return css
    }
    if (toArray(css.exclude).some(re => re.test(id))) {
      return false
    }
    if (toArray(css.include).some(re => re.test(id))) {
      return true
    }
    return false
  }

  return [
    {
      name: 'vitest:css-disable',
      enforce: 'pre',
      transform(code, id) {
        if (!isCSS(id)) {
          return
        }
        // css plugin inside Vite won't do anything if the code is empty
        // but it will put __vite__updateStyle anyway
        if (!shouldProcessCSS(id)) {
          return { code: '' }
        }
      },
    },
    {
      name: 'vitest:css-empty-post',
      enforce: 'post',
      transform(_, id) {
        if (!isCSS(id) || shouldProcessCSS(id)) {
          return
        }

        if (isCSSModule(id) && !isInline(id)) {
          // return proxy for css modules, so that imported module has names:
          // styles.foo returns a "foo" instead of "undefined"
          // we don't use code content to generate hash for "scoped", because it's empty
          const scopeStrategy
            = (typeof ctx.config.css !== 'boolean'
              && ctx.config.css.modules?.classNameStrategy)
            || 'stable'
          const proxyReturn = getCSSModuleProxyReturn(
            scopeStrategy,
            relative(ctx.config.root, id),
          )
          const code = `export default new Proxy(Object.create(null), {
            get(_, style) {
              return ${proxyReturn};
            },
          })`
          return { code }
        }

        return { code: 'export default ""' }
      },
    },
  ]
}
