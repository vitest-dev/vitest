import type { SourceMap } from 'magic-string'
import type { WorkerSetupContext } from '../../types/worker'
import type { NativeModuleMocker } from '../moduleRunner/nativeModuleMocker'
import module, { isBuiltin } from 'node:module'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'
import { hoistMocks } from '@vitest/mocker/transforms'
import { cleanUrl } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { init as initCjsLexer } from 'cjs-module-lexer'
import { init as initModuleLexer } from 'es-module-lexer'
import MagicString from 'magic-string'
import { resolve } from 'pathe'
import { distDir } from '../../paths'

const NOW_LENGTH = Date.now().toString().length
const REGEXP_VITEST = new RegExp(`%3Fvitest=\\d{${NOW_LENGTH}}`)

export async function setupNodeLoaderHooks(worker: WorkerSetupContext): Promise<void> {
  module.setSourceMapsSupport(true)

  if (worker.config.experimental.nodeLoader !== false) {
    await Promise.all([
      initCjsLexer(),
      initModuleLexer,
    ])
  }

  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier.includes('mock=actual')) {
          // url is already resolved by `importActual`
          return {
            url: specifier.replace(/\?mock=actual/, ''), // TODO: normalize work with queries
            shortCircuit: true,
          }
        }

        const isVitest = specifier.includes('%3Fvitest=')
        const result = nextResolve(
          isVitest ? specifier.replace(REGEXP_VITEST, '') : specifier,
          context,
        )

        // avoid /node_modules/ for performance reasons
        if (context.parentURL && result.url && !result.url.includes('/node_modules/')) {
          worker.rpc.ensureModuleGraphEntry(result.url, context.parentURL).catch(() => {
            // ignore errors
          })
        }

        // this is require for in-source tests to be invalidated if
        // one of the files already imported it in --maxWorkers=1 --no-isolate
        if (isVitest) {
          result.url = `${result.url}?vitest=${Date.now()}`
        }
        // TODO: better distDir check
        if (
          worker.config.experimental.nodeLoader === false
          || !context.parentURL
          || result.url.includes(distDir)
          || context.parentURL?.toString().includes(distDir)
        ) {
          return result
        }

        const mocker = getNativeMocker()
        const mockedResult = mocker?.resolveMockedModule(result.url, context.parentURL)
        if (mockedResult != null) {
          return mockedResult
        }

        return result
      },
      load: worker.config.experimental.nodeLoader === false
        ? undefined
        : createLoadHook(worker),
    })
  }
  else if (module.register) {
    if (worker.config.experimental.nodeLoader !== false) {
      console.warn(
        `"module.registerHooks" is not supported in Node.js ${process.version}. This means that some features like module mocking or in-source testing are not supported. Upgrade your Node.js version to at least 22.15 or disable "experimental.nodeLoader" flag manually.`,
      )
    }
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
    // should it support process.vitest for CJS modules?
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
    const result: module.LoadFnOutput = url.includes('mock=manual') && isBuiltin(cleanUrl(url))
      ? { format: 'module' } // avoid resolving the builtin module that is supposed to be mocked
      : nextLoad(url, context)
    if (
      (result.format && ignoreFormats.has(result.format))
      || url.includes(distDir)
    ) {
      return result
    }

    getNativeMocker()?.checkCircularManualMock(url)

    if (url.includes('mock=automock') || url.includes('mock=autospy')) {
      const automockedResult = getNativeMocker()?.loadAutomock(url, result)
      if (automockedResult != null) {
        return automockedResult
      }
      return result
    }

    if (url.includes('mock=manual')) {
      const mockedResult = getNativeMocker()?.loadManualMock(url, result)
      if (mockedResult != null) {
        return mockedResult
      }
      return result
    }

    // ignore non-vitest modules for performance reasons,
    // vi.hoisted and vi.mock won't work outside of test files or setup files
    if (!result.source || !url.includes('vitest=')) {
      return result
    }

    const filename = url.startsWith('file://') ? fileURLToPath(url) : url
    const source = result.source.toString()
    const transformedCode = result.format?.includes('typescript')
      ? module.stripTypeScriptTypes(source)
      : source

    let _ms: MagicString | undefined
    const ms = () => _ms || (_ms = new MagicString(source))

    if (source.includes('import.meta.vitest')) {
      replaceInSourceMarker(url, source, ms)
    }

    hoistMocks(
      transformedCode,
      filename,
      code => parse(code, {
        ecmaVersion: 'latest',
        sourceType: result.format === 'module' || result.format === 'module-typescript' || result.format === 'typescript'
          ? 'module'
          : 'script',
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
      code = `${transformed}\n//# sourceMappingURL=${genSourceMapUrl(map)}`
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
