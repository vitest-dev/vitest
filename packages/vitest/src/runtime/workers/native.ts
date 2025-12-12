import type { SourceMap } from 'node:module'
import type { WorkerSetupContext } from '../../types/worker'
import type { NativeModuleMocker } from '../moduleRunner/nativeModuleMocker'
import { readFileSync } from 'node:fs'
import module from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MessageChannel } from 'node:worker_threads'
import { automockModule, createManualModuleSource, hoistMocks } from '@vitest/mocker/transforms'
import { cleanUrl } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { initSync as initCjsLexer, parse as parseCjsSyntax } from 'cjs-module-lexer'
import { initSync as initModuleLexer, parse as parseModuleSyntax } from 'es-module-lexer'
import MagicString from 'magic-string'
import { extname, resolve } from 'pathe'
import { distDir } from '../../paths'

// module.findPackageJSON() TODO: exists since 22.14
const NOW_LENGTH = Date.now().toString().length
const REGEXP_VITEST = new RegExp(`%3Fvitest=\\d{${NOW_LENGTH}}`)

// TODO: add createDebug()

let moduleLexerReady = false
let cjsLexerReady = false

export function setupNodeLoaderHooks(worker: WorkerSetupContext): void {
  module.setSourceMapsSupport(true)

  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const isVitest = specifier.includes('%3Fvitest=')
        const result = nextResolve(isVitest ? specifier.replace(REGEXP_VITEST, '') : specifier, context)

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
        if (mockedModule.type === 'manual') {
          return {
            url: injectQuery(result.url, context.parentURL, 'mock=manual'),
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
      if (url.includes('mock=automock') || url.includes('mock=autospy')) {
        const mockType = url.includes('mock=automock') ? 'automock' : 'autospy'
        const transformedCode = result.format === 'module-typescript' || result.format === 'commonjs-typescript' || result.format === 'typescript'
          ? module.stripTypeScriptTypes(source)
          : source
        const ms = automockModule(transformedCode, mockType, code => parse(code, {
          ecmaVersion: 'latest',
          sourceType: result.format === 'module' || result.format === 'module-typescript' ? 'module' : 'script',
        }))
        const transformed = ms.toString()
        const map = ms.generateMap({ hires: 'boundary', source: filename })
        const code = `${transformed}\n//# sourceMappingURL=${genSourceMapUrl(map as any)}`

        return {
          format: 'module',
          source: code,
          shortCircuit: true,
        }
      }
      if (url.includes('mock=manual')) {
        const mocker = getNativeMocker()
        const mockedModule = mocker?.getDependencyMock(cleanUrl(filename))
        // should not be possible
        if (mockedModule?.type !== 'manual') {
          console.warn(`Vitest detected unregistered manual mock ${filename}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
          return result
        }

        const mockedFactoryResult = mockedModule.resolve()
        // the factory is _not_ a promise, we can just take returned exports without
        // parsing the original file
        if (typeof mockedFactoryResult.then !== 'function') {
          const keys = Object.keys(mockedFactoryResult)
          const manualMockedModule = createManualModuleSource(filename, keys)

          return {
            format: 'module',
            source: manualMockedModule,
            shortCircuit: true,
          }
        }
        // noop the error handling to avoid unhandled rejections
        // it will still throw an error when importing the module
        mockedFactoryResult.then(() => {}, () => {})

        // since the factory returned an async result, we have to figure out keys synchronosly somehow
        // so we parse the module with es/cjs-module-lexer to find the original exports -- we assume the same ones are returned
        // injecting new keys is not supported (and should not be advised anyway)

        const transformedCode = result.format === 'module-typescript' || result.format === 'commonjs-typescript' || result.format === 'typescript'
          ? module.stripTypeScriptTypes(source)
          : source

        const format = result.format?.startsWith('module') ? 'module' : 'commonjs'
        const exports = collectModuleExports(filename, transformedCode, format)
        // TODO: what about re-exports? is it better to require `vi.mock` factory to be sync?
        // for performance reasons we can go one deep inside, _maybe_?
        const manualMockedModule = createManualModuleSource(filename, exports)

        return {
          format: 'module',
          source: manualMockedModule,
          shortCircuit: true,
        }
      }

      let _ms: MagicString | undefined
      const ms = () => _ms || (_ms = new MagicString(source))

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

// this is a bit too much for a small feature -- maybe just allow only sync
// TODO: caching for better perf
function collectModuleExports(
  filename: string,
  code: string,
  format: 'module' | 'commonjs',
  exports: string[] = [],
): string[] {
  if (format === 'module') {
    if (!moduleLexerReady) {
      initModuleLexer()
      moduleLexerReady = true
    }
    const [imports_, exports_] = parseModuleSyntax(code, filename)
    exports.push(...exports_.map(p => p.n))
    imports_.forEach(({ ss: start, se: end, n: name }) => {
      const substring = code.substring(start, end).replace(/ +/g, ' ')
      if (name && substring.startsWith('export *') && !substring.startsWith('export * as')) {
        parseModule(name)
      }
    })
  }
  else {
    if (!cjsLexerReady) {
      initCjsLexer()
      cjsLexerReady = true
    }
    const { exports: exports_, reexports } = parseCjsSyntax(code, filename)
    exports.push(...exports_)
    reexports.forEach((name) => {
      parseModule(name)
    })
  }

  function parseModule(name: string) {
    const resolvedModuleUrl = import.meta.resolve(name, pathToFileURL(filename))
    const resolveModulePath = fileURLToPath(resolvedModuleUrl)
    const fileContent = readFileSync(resolveModulePath, 'utf-8')
    const ext = extname(resolvedModuleUrl)
    const isTs = ext === '.ts' || ext === '.cts' || ext === '.mts'
    // TODO: check if in node_modules, what if it should be processed by another module loader? -- >:((((
    const code = isTs
      ? module.stripTypeScriptTypes(fileContent)
      : fileContent
    let format: 'module' | 'commonjs'
    if (ext === '.cjs' || ext === '.cts') {
      format = 'commonjs'
    }
    else if (ext === '.mjs' || ext === '.mts') {
      format = 'module'
    }
    else {
      // TODO: node has a flag to switch the behavior
      const pkgJsonPath = module.findPackageJSON(resolvedModuleUrl) // min Node 22.14
      const pkgJson = pkgJsonPath ? JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) : {}
      if (pkgJson?.type === 'module') {
        format = 'module'
      }
      else {
        format = 'commonjs'
      }
    }
    collectModuleExports(resolveModulePath, code, format, exports)
  }

  return Array.from(new Set(exports))
}
