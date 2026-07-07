import type { Plugin } from 'vitest/config'
import type { BrowserServerContribution } from 'vitest/node'
import type { ParentBrowserProject } from './projectParent'
import { dynamicImportPlugin } from '@vitest/mocker/node'
import MagicString from 'magic-string'
import { resolve } from 'pathe'
import { distRoot } from './constants'
import BrowserContext from './plugins/pluginContext'

export type { BrowserCommand } from 'vitest/node'

export default (contribution: BrowserServerContribution): Plugin[] => {
  return [
    {
      name: 'vitest:browser:tests',
      enforce: 'pre',
      resolveId: {
        order: 'pre',
        handler(id) {
          if (!/\?browserv=\w+$/.test(id)) {
            return
          }

          let useId = id.slice(0, id.lastIndexOf('?'))
          if (useId.startsWith('/@fs/')) {
            useId = useId.slice(5)
          }

          if (/^\w:/.test(useId)) {
            useId = useId.replace(/\\/g, '/')
          }

          return useId
        },
      },
    },
    {
      name: 'vitest:browser:assets',
      resolveId(id) {
        if (id.startsWith('/__vitest_browser__/')) {
          return resolve(distRoot, 'client', id.slice(1))
        }
      },
      transform(code, id) {
        const parentServer = contribution.parent as ParentBrowserProject
        if (id.includes(parentServer.vite.config.cacheDir) && id.includes('loupe.js')) {
          // loupe bundle has a nasty require('util') call that leaves a warning in the console
          const utilRequire = 'nodeUtil = require_util();'
          return code.replace(utilRequire, ' '.repeat(utilRequire.length))
        }
      },
    },
    BrowserContext(contribution),
    dynamicImportPlugin({
      globalThisAccessor: '"__vitest_browser_runner__"',
      // injected only into the `client` environment via the browser contribution
      filter(id) {
        if (id.includes(distRoot)) {
          return false
        }
        return true
      },
    }),
    {
      name: 'vitest:browser:in-source-tests',
      transform: {
        filter: {
          code: /import\.meta\.vitest/,
        },
        handler(code, id) {
          const filename = cleanUrl(id)

          if (!code.includes('import.meta.vitest')) {
            return
          }
          const s = new MagicString(code, { filename })
          s.prepend(
            `Object.defineProperty(import.meta, 'vitest', { get() { return typeof __vitest_worker__ !== 'undefined' && __vitest_worker__.filepath === "${filename.replace(/"/g, '\\"')}" ? __vitest_index__ : undefined } });\n`,
          )
          return {
            code: s.toString(),
            map: s.generateMap({ hires: true }),
          }
        },
      },
    },
    {
      name: 'vitest:browser:worker',
      transform(code, id, _options) {
        // https://github.com/vitejs/vite/blob/ba56cf43b5480f8519349f7d7fe60718e9af5f1a/packages/vite/src/node/plugins/worker.ts#L46
        if (/(?:\?|&)worker_file&type=\w+(?:&|$)/.test(id)) {
          const s = new MagicString(code)
          s.prepend('globalThis.__vitest_browser_runner__ = { wrapDynamicImport: f => f() };\n')
          return {
            code: s.toString(),
            map: s.generateMap({ hires: 'boundary' }),
          }
        }
      },
    },
    {
      name: 'vitest:browser:__vitest_browser_import_meta_env_init__',
      transform: {
        handler(code) {
          // this transform runs after `vitest:meta-env-replacer` so that
          // `import.meta.env` will be handled by Vite import analysis to match behavior.
          if (code.includes('__vitest_browser_import_meta_env_init__')) {
            return code.replace('__vitest_browser_import_meta_env_init__', 'import.meta.env')
          }
        },
      },
    },
  ]
}

const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
