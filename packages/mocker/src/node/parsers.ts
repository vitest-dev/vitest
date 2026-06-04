import { readFileSync } from 'node:fs'
import module, { createRequire, isBuiltin } from 'node:module'
import { extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { filterOutComments } from '@vitest/utils/helpers'
import { init as initCjsLexer, parse as parseCjsSyntax } from 'cjs-module-lexer'
import { init as initModuleLexer, parse as parseModuleSyntax } from 'es-module-lexer'

export async function initSyntaxLexers(): Promise<void> {
  await Promise.all([
    initCjsLexer(),
    initModuleLexer,
  ])
}

const isTransform = process.execArgv.includes('--experimental-transform-types')
  || process.env.NODE_OPTIONS?.includes('--experimental-transform-types')

export function transformCode(code: string, filename: string): string {
  const ext = extname(filename.split('?')[0])
  const isTs = ext === '.ts' || ext === '.cts' || ext === '.mts'
  if (!isTs) {
    return code
  }
  if (!module.stripTypeScriptTypes) {
    throw new Error(`Cannot parse '${filename}' because "module.stripTypeScriptTypes" is not supported. Module mocking requires Node.js 22.15 or higher. This is NOT a bug of Vitest.`)
  }
  return module.stripTypeScriptTypes(code, { mode: isTransform ? 'transform' : 'strip' })
}

const cachedFileExports = new Map<string, string[]>()

export function collectModuleExports(
  filename: string,
  code: string,
  format: 'module' | 'commonjs',
  exports: string[] = [],
): string[] {
  if (format === 'module') {
    const [imports_, exports_] = parseModuleSyntax(code, filename)
    const fileExports = [...exports_.map(p => p.n)]
    imports_.forEach(({ ss: start, se: end, n: name }) => {
      const substring = code.substring(start, end).replace(/ +/g, ' ')
      if (name && substring.startsWith('export *') && !substring.startsWith('export * as')) {
        fileExports.push(...tryParseModule(name))
      }
    })
    cachedFileExports.set(filename, fileExports)
    exports.push(...fileExports)
  }
  else {
    const { exports: exports_, reexports } = parseCjsSyntax(code, filename)
    const fileExports = [...exports_]
    reexports.forEach((name) => {
      fileExports.push(...tryParseModule(name))
    })
    cachedFileExports.set(filename, fileExports)
    exports.push(...fileExports)
  }

  function tryParseModule(name: string): string[] {
    try {
      return parseModule(name)
    }
    catch (error) {
      console.warn(`[module mocking] Failed to parse '${name}' imported from ${filename}:`, error)
      return []
    }
  }

  let __require: NodeJS.Require | undefined
  function getModuleRequire() {
    return (__require ??= createRequire(filename))
  }

  function parseModule(name: string): string[] {
    if (isBuiltin(name)) {
      if (cachedFileExports.has(name)) {
        const cachedExports = cachedFileExports.get(name)!
        return cachedExports
      }

      const builtinModule = getBuiltinModule(name)
      const builtinExports = Object.keys(builtinModule)
      cachedFileExports.set(name, builtinExports)
      return builtinExports
    }

    const resolvedModuleUrl = format === 'module'
      ? import.meta.resolve(name, pathToFileURL(filename).toString())
      : getModuleRequire().resolve(name)

    const resolvedModulePath = format === 'commonjs'
      ? resolvedModuleUrl
      : fileURLToPath(resolvedModuleUrl)

    if (cachedFileExports.has(resolvedModulePath)) {
      return cachedFileExports.get(resolvedModulePath)!
    }

    const fileContent = readFileSync(resolvedModulePath, 'utf-8')
    const ext = extname(resolvedModulePath)
    const code = transformCode(fileContent, resolvedModulePath)
    if (code == null) {
      cachedFileExports.set(resolvedModulePath, [])
      return []
    }

    const resolvedModuleFormat = resolveModuleFormat(resolvedModulePath, code)
    if (ext === '.json') {
      return ['default']
    }
    else {
      // can't do wasm, for example
      console.warn(`Cannot process '${resolvedModuleFormat}' imported from ${filename} because of unknown file extension: ${ext}.`)
    }
    if (resolvedModuleFormat) {
      return collectModuleExports(resolvedModulePath, code, resolvedModuleFormat, exports)
    }
    return []
  }

  return Array.from(new Set(exports))
}

export function resolveModuleFormat(url: string, code: string): 'module' | 'commonjs' | undefined {
  const ext = extname(url)

  if (ext === '.cjs' || ext === '.cts') {
    return 'commonjs'
  }
  else if (ext === '.mjs' || ext === '.mts') {
    return 'module'
  }
  // https://nodejs.org/api/packages.html#syntax-detection
  else if (ext === '.js' || ext === '.ts' || ext === '') {
    if (!module.findPackageJSON) {
      throw new Error(`Cannot parse the module format of '${url}' because "module.findPackageJSON" is not available. Upgrade to Node 22.14 to use this feature. This is NOT a bug of Vitest.`)
    }
    const pkgJsonPath = module.findPackageJSON(url)
    const pkgJson = pkgJsonPath ? JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) : {}
    if (pkgJson?.type === 'module') {
      return 'module'
    }
    else if (pkgJson?.type === 'commonjs') {
      return 'commonjs'
    }
    else {
      // Ambiguous input! Check if it has ESM syntax. Node.js is much smarter here,
      // but we don't need to run the code, so we can be more relaxed
      if (hasESM(filterOutComments(code))) {
        return 'module'
      }
      else {
        return 'commonjs'
      }
    }
  }
  return undefined
}

let __globalRequire: NodeJS.Require | undefined
function getBuiltinModule(moduleId: string) {
  __globalRequire ??= module.createRequire(import.meta.url)
  return __globalRequire(moduleId)
}

const ESM_RE
  = /(?:[\s;]|^)(?:import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m

function hasESM(code: string) {
  return ESM_RE.test(code)
}
