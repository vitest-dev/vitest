import type { SourceMap } from 'node:module'
import type { WorkerSetupContext } from '../../types/worker'
import type { NativeModuleMocker } from '../moduleRunner/nativeModuleMocker'
import module from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MessageChannel } from 'node:worker_threads'
import { automockModule, hoistMocks } from '@vitest/mocker/transforms'
import { cleanUrl } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import MagicString from 'magic-string'
import { resolve } from 'pathe'
import { distDir } from '../../paths'

export function setupNodeLoaderHooks(worker: WorkerSetupContext): void {
  module.setSourceMapsSupport(true)

  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context)
        // avoid /node_modules/ for performance reasons
        if (context.parentURL && result.url && !result.url.includes('/node_modules/')) {
          worker.rpc.ensureModuleGraphEntry(result.url, context.parentURL).catch(() => {
            // ignore errors
          })
        }
        // TODO: better distDir check
        if (worker.config.experimental.nodeLoader === false || result.url.includes(distDir)) {
          return result
        }

        const mocker = getNativeMocker()
        if (!mocker || !context.parentURL) {
          return result
        }
        const url = result.url
        const moduelId = url.startsWith('file://') ? fileURLToPath(url) : url
        const mockedModule = mocker?.getDependencyMock(moduelId)
        if (!mockedModule) {
          return result
        }
        if (mockedModule.type === 'redirect') {
          return {
            url: pathToFileURL(mockedModule.redirect).toString(),
            shortCircuit: true,
          }
        }
        if (mockedModule.type === 'automock' || mockedModule.type === 'autospy') {
          return {
            url: injectQuery(result.url, context.parentURL, `mock=${mockedModule.type}`),
            shortCircuit: true,
          }
        }

        return result
      },
      load: worker.config.experimental.nodeLoader === false
        ? undefined
        : createLoadHook(worker),
    })
  }
  // TODO
  else if (module.register) {
    const { port1, port2 } = new MessageChannel()
    port1.unref()
    port2.unref()
    port1.on('message', (data) => {
      if (!data || typeof data !== 'object') {
        return
      }
      switch (data.event) {
        case 'register-module-graph-entry': {
          const { url, parentURL } = data
          worker.rpc.ensureModuleGraphEntry(url, parentURL)
          return
        }
        default: {
          console.error('Unknown message event:', data.event)
        }
      }
    })
    module.register('#test-loader', {
      parentURL: import.meta.url,
      data: { port: port2 },
      transferList: [port2],
    })
  }
  else if (!process.versions.deno && !process.versions.bun) {
    console.warn(
      '"module.registerHooks" and "module.register" are not supported. Some Vitest features may not work. Please, use Node.js 18.19.0 or higher.',
    )
  }
}

function replaceInSourceMarker(url: string, source: string, ms: () => MagicString) {
  const re = /import\.meta\.vitest/g
  let match: RegExpExecArray | null
  let overriden = true
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(source))) {
    if (!match) {
      return
    }
    const { index, '0': code } = match
    overriden = true
    ms().overwrite(index, index + code.length, 'IMPORT_META_VITEST') // the length is the same
  }
  if (overriden) {
    const filename = resolve(fileURLToPath(url))
    ms().prepend(`const IMPORT_META_VITEST = typeof __vitest_worker__ !== 'undefined' && __vitest_worker__.filepath === "${filename.replace(/"/g, '\\"')}" ? __vitest_index__ : undefined;`)
  }
}

const ignoreFormats = new Set<string>([
  'addon',
  'builtin',
  'wasm',
])

function createLoadHook(_worker: WorkerSetupContext): module.LoadHookSync {
  return (url, context, nextLoad) => {
    const result = nextLoad(url, context)
    if (
      (result.format && ignoreFormats.has(result.format))
      // ignore node_modules for performance reasons
      || url.includes('/node_modules/')
      || url.includes(distDir)
    ) {
      return result
    }
    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const source = result.source?.toString()
    if (typeof source === 'string') {
      let _ms: MagicString | undefined
      const ms = () => _ms || (_ms = new MagicString(source))

      if (url.includes('mock=automock') || url.includes('mock=autospy')) {
        const mockType = url.includes('mock=automock') ? 'automock' : 'autospy'
        const transformedCode = result.format === 'module-typescript' || result.format === 'commonjs-typescript'
          ? module.stripTypeScriptTypes(source)
          : source
        const code = automockModule(transformedCode, mockType, code => parse(code, {
          ecmaVersion: 'latest',
          sourceType: result.format === 'module' || result.format === 'module-typescript' ? 'module' : 'script',
        }))

        return {
          format: 'module',
          source: code.toString(),
          shortCircuit: true,
        }
      }

      if (source.includes('import.meta.vitest')) {
        replaceInSourceMarker(url, source, ms)
      }

      hoistMocks(
        source,
        filename,
        code => parse(code, {
          ecmaVersion: 'latest',
          sourceType: result.format === 'module' || result.format === 'module-typescript' ? 'module' : 'script',
        }),
        {
          magicString: ms,
          globalThisAccessor: '"__vitest_mocker__"',
        },
      )

      let code: string
      if (_ms) {
        const transformed = _ms.toString()
        const map = _ms.generateMap({ hires: 'boundary', source: filename })
        code = `${transformed}\n//# sourceMappingURL=${genSourceMapUrl(map as any)}`
      }
      else {
        code = source
      }

      return {
        format: result.format,
        shortCircuit: true,
        source: code,
      }
    }
    return result
  }
}

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

function getNativeMocker() {
  const mocker: NativeModuleMocker | undefined
  // @ts-expect-error untyped global
    = typeof __vitest_mocker__ !== 'undefined' ? __vitest_mocker__ : undefined
  return mocker
}

const replacePercentageRE = /%/g
function injectQuery(url: string, importer: string, queryToInject: string): string {
  // encode percents for consistent behavior with pathToFileURL
  // see #2614 for details
  const resolvedUrl = new URL(
    url.replace(replacePercentageRE, '%25'),
    importer,
  )
  const { search, hash } = resolvedUrl
  const pathname = cleanUrl(url)
  return `${pathname}?${queryToInject}${search ? `&${search.slice(1)}` : ''}${
    hash ?? ''
  }`
}
