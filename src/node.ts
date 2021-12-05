import { builtinModules, createRequire } from 'module'
import { pathToFileURL } from 'url'
import { dirname, resolve, relative } from 'path'
import vm from 'vm'
import { createServer, mergeConfig, InlineConfig, ViteDevServer } from 'vite'
import c from 'picocolors'

const { red, dim, yellow } = c

export interface ViteNodeOptions {
  silent?: boolean
  root: string
  files: string[]
  _?: string[]
  shouldExternalize?: (file: string) => boolean
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

  // @ts-expect-error
  process.__vite_node__ = {
    server,
  }

  try {
    await execute(files, server, argv)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    await server.close()
  }
}

function normalizeId(id: string): string {
  // Virtual modules start with `\0`
  if (id && id.startsWith('/@id/__x00__'))
    id = `\0${id.slice('/@id/__x00__'.length)}`
  if (id && id.startsWith('/@id/'))
    id = id.slice('/@id/'.length)
  return id
}

function toFilePath(id: string, server: ViteDevServer): string {
  let absolute = id.startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(server.config.root))
      ? id
      : slash(resolve(server.config.root, id.slice(1)))

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)
  if (!absolute.startsWith('/'))
    absolute = `/${absolute}`

  return absolute
}

async function execute(files: string[], server: ViteDevServer, options: ViteNodeOptions) {
  const __pendingModules__ = new Map<string, Promise<any>>()

  const result = []
  for (const file of files)
    result.push(await cachedRequest(`/@fs/${slash(resolve(file))}`, []))
  return result

  async function directRequest(rawId: string, callstack: string[]) {
    if (builtinModules.includes(rawId))
      return import(rawId)

    callstack = [...callstack, rawId]
    const request = async(dep: string) => {
      if (callstack.includes(dep)) {
        throw new Error(`${red('Circular dependency detected')}\nStack:\n${[...callstack, dep].reverse().map((i) => {
          const path = relative(server.config.root, toFilePath(normalizeId(i), server))
          return dim(' -> ') + (i === dep ? yellow(path) : path)
        }).join('\n')}\n`)
      }
      return cachedRequest(dep, callstack)
    }

    const id = normalizeId(rawId)
    const absolute = toFilePath(id, server)

    if (options.shouldExternalize!(absolute))
      return import(absolute)

    const result = await server.transformRequest(id, { ssr: true })
    if (!result)
      throw new Error(`failed to load ${id}`)

    const url = pathToFileURL(absolute)
    const exports = {}

    const context = {
      require: createRequire(url),
      __filename: absolute,
      __dirname: dirname(absolute),
      __vite_ssr_import__: request,
      __vite_ssr_dynamic_import__: request,
      __vite_ssr_exports__: exports,
      __vite_ssr_exportAll__: (obj: any) => exportAll(exports, obj),
      __vite_ssr_import_meta__: { url },
    }

    const fn = vm.runInThisContext(`async (${Object.keys(context).join(',')}) => { ${result.code} }`, {
      filename: absolute,
      lineOffset: 0,
    })
    await fn(...Object.values(context))

    return exports
  }

  async function cachedRequest(id: string, callstack: string[]) {
    if (__pendingModules__.has(id))
      return __pendingModules__.get(id)
    __pendingModules__.set(id, directRequest(id, callstack))
    return await __pendingModules__.get(id)
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
