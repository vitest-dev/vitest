import type { Plugin as VitePlugin } from 'vite'
import type { ResolvedConfig } from '../types/config'
import { isBuiltin } from 'node:module'
import { pathToFileURL } from 'node:url'
import { cleanUrl } from '@vitest/utils/helpers'
import MagicString from 'magic-string'
import { dirname } from 'pathe'
import { stripLiteral } from 'strip-literal'
import { isBrowserExternal, toBuiltin } from '../../utils/modules'
import {
  captureBundledDevClientListeners,
  getBundledEnvironmentNames,
} from '../environments/bundledEnvironments'
import { VitestResolver } from '../resolver'

const IMPORT_META_RE = /\bimport\.meta\.(url|filename|dirname|vitest)\b/g

/**
 * Bundled environments cannot externalize modules when they are fetched,
 * so Vitest's externalization rules are applied when the bundle is built.
 * The bundle is also evaluated from a virtual chunk, so module-specific
 * `import.meta` properties are replaced with the values of the source file.
 */
export function BundledEnvironmentPlugin(): VitePlugin {
  const resolvers = new WeakMap<ResolvedConfig, VitestResolver>()

  return {
    name: 'vitest:bundled-environment',
    enforce: 'pre',
    configureServer(server) {
      captureBundledDevClientListeners(server)
    },
    applyToEnvironment(environment) {
      return getBundledEnvironmentNames(environment.getTopLevelConfig()).includes(environment.name)
    },
    async resolveId(source, importer, options) {
      if (!importer || options.isEntry || source[0] === '\0' || source.startsWith('virtual:')) {
        return
      }
      // browser-like environments prefer installed packages over Node.js builtins
      if (this.environment.config.consumer === 'server' && isBuiltin(source)) {
        return { id: source, external: true }
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      // unresolved modules should fail when they are imported, not when the bundle is built
      if (!resolved) {
        return { id: source, external: true }
      }
      if (resolved.external) {
        return resolved
      }
      if (isBrowserExternal(resolved.id)) {
        return { id: toBuiltin(resolved.id), external: true }
      }
      const viteConfig = this.environment.getTopLevelConfig()
      const config = viteConfig.test
      if (!config) {
        return resolved
      }
      let resolver = resolvers.get(config)
      if (!resolver) {
        resolver = new VitestResolver(viteConfig.cacheDir, config)
        resolvers.set(config, resolver)
      }
      const externalize = await resolver.shouldExternalize(resolved.id)
      if (externalize) {
        return { id: externalize, external: 'absolute' }
      }
      return resolved
    },
    transform: {
      order: 'post',
      filter: { code: 'import.meta' },
      handler(code, id) {
        const file = cleanUrl(id)
        if (file[0] === '\0') {
          return
        }
        const s = new MagicString(code)
        for (const match of stripLiteral(code).matchAll(IMPORT_META_RE)) {
          s.overwrite(
            match.index,
            match.index + match[0].length,
            getImportMetaValue(match[1], file),
          )
        }
        if (!s.hasChanged()) {
          return
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: 'boundary', source: file }),
        }
      },
    },
  }
}

function getImportMetaValue(property: string, file: string): string {
  switch (property) {
    case 'url':
      return JSON.stringify(pathToFileURL(file).href)
    case 'filename':
      return JSON.stringify(file)
    case 'dirname':
      return JSON.stringify(dirname(file))
    case 'vitest':
      return `(globalThis.__vitest_worker__?.filepath === ${JSON.stringify(file)} ? globalThis.__vitest_index__ : undefined)`
    default:
      return `import.meta.${property}`
  }
}
