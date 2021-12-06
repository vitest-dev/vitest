import { builtinModules, createRequire } from 'module'
import { pathToFileURL } from 'url'
import { dirname, resolve, relative } from 'path'
import vm from 'vm'
import { createServer, mergeConfig, InlineConfig, ViteDevServer } from 'vite'
import c from 'picocolors'

const { red, dim, yellow } = c

declare global {
  namespace NodeJS {
    interface Process {
      __vite_node__: {
        server: ViteDevServer
        watch?: boolean
        moduleCache: Map<string, Promise<any>>
      }
    }
  }
}

const __pendingModules__ = new Map<string, Promise<any>>()

export interface ViteNodeOptions {
  silent?: boolean
  root: string
  files: string[]
  _?: string[]
  shouldExternalize?: (file: string, server: ViteDevServer) => boolean
  config?: string
  defaultConfig?: InlineConfig
}

export async function run(argv: ViteNodeOptions) {
  process.exitCode = 0

  const root = argv.root || process.cwd()
  process.chdir(root)

  const files = argv.files || argv._

  argv.shouldExternalize = argv.shouldExternalize || (id => id.includes('/node_modules/'))

  const server = await createServer(mergeConfig(argv.defaultConfig || {}, {
    logLevel: 'error',
    clearScreen: false,
    configFile: argv.config,
    root,
    resolve: {},
  }))
  await server.pluginContainer.buildStart({})

  process.__vite_node__ = {
    server,
    moduleCache: __pendingModules__,
  }

  try {
    await execute(files, server, argv)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    if (!process.__vite_node__.watch)
      await server.close()
  }
}

function normalizeId(id: string): string {
  // Virtual modules start with `\0`
  if (id && id.startsWith('/@id/__x00__'))
    id = `\0${id.slice('/@id/__x00__'.length)}`
  if (id && id.startsWith('/@id/'))
    id = id.slice('/@id/'.length)
  if (id.startsWith('__vite-browser-external:'))
    id = id.slice('__vite-browser-external:'.length)
  return id
}

function toFilePath(id: string, server: ViteDevServer): string {
  let absolute = id.startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(server.config.root))
      ? id
      : id.startsWith('/')
        ? slash(resolve(server.config.root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)
  if (!absolute.startsWith('/'))
    absolute = `/${absolute}`

  return absolute
}

const stubRequests: Record<string, any> = {
  '/@vite/client': {
    injectQuery: (id: string) => id,
    createHotContext() {
      return {
        accept: () => {},
      }
    },
  },
}

async function transform(server: ViteDevServer, id: string) {
  if (id.match(/\.(?:[cm]?[jt]sx?|json)$/)) {
    return await server.transformRequest(id, { ssr: true })
  }
  else {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
    const result = await server.transformRequest(id)
    if (!result)
      return undefined
    return await server.ssrTransform(result.code, result.map, id)
  }
}

async function execute(files: string[], server: ViteDevServer, options: ViteNodeOptions) {
  const result = []
  for (const file of files)
    result.push(await cachedRequest(`/@fs/${slash(resolve(file))}`, []))
  return result

  async function directRequest(id: string, fsPath: string, callstack: string[]) {
    callstack = [...callstack, id]
    const request = async(dep: string) => {
      if (callstack.includes(dep)) {
        throw new Error(`${red('Circular dependency detected')}\nStack:\n${[...callstack, dep].reverse().map((i) => {
          const path = relative(server.config.root, toFilePath(normalizeId(i), server))
          return dim(' -> ') + (i === dep ? yellow(path) : path)
        }).join('\n')}\n`)
      }
      return cachedRequest(dep, callstack)
    }

    if (id in stubRequests)
      return stubRequests[id]

    const result = await transform(server, id)
    if (!result)
      throw new Error(`failed to load ${id}`)

    const url = pathToFileURL(fsPath)
    const exports = {}

    const context = {
      require: createRequire(url),
      __filename: fsPath,
      __dirname: dirname(fsPath),
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },
    }

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')}) => { ${result.code} }`, {
      filename: fsPath,
      lineOffset: 0,
    })
    await fn(...Object.values(context))

    return exports
  }

  async function cachedRequest(rawId: string, callstack: string[]) {
    const id = normalizeId(rawId)

    if (builtinModules.includes(id))
      return import(id)

    const fsPath = toFilePath(id, server)

    if (options.shouldExternalize!(fsPath, server))
      return import(fsPath)

    if (__pendingModules__.has(fsPath))
      return __pendingModules__.get(fsPath)
    __pendingModules__.set(fsPath, directRequest(id, fsPath, callstack))
    return await __pendingModules__.get(fsPath)
  }

  function exportAll(exports: any, sourceModule: any) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key in sourceModule) {
      if (key !== 'default') {
        try {
          Object.defineProperty(exports, key, {
            enumerable: true,
            configurable: true,
            get() { return sourceModule[key] },
          })
        }
        catch (_err) { }
      }
    }
  }
}

function slash(path: string) {
  return path.replace(/\\/g, '/')
}
