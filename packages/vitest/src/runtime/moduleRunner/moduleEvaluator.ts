import type { Span } from '@opentelemetry/api'
import type {
  EvaluatedModuleNode,
  ModuleEvaluator,
  ModuleRunnerContext,
  ModuleRunnerImportMeta,
} from 'vite/module-runner'
import type { VitestEvaluatedModules } from './evaluatedModules'
import type { ModuleExecutionInfo } from './moduleDebug'
import type { VitestVmOptions } from './moduleRunner'
import { createRequire, isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import {
  ssrDynamicImportKey,
  ssrExportAllKey,
  ssrImportKey,
  ssrImportMetaKey,
  ssrModuleExportsKey,
} from 'vite/module-runner'
import { Traces } from '../../utils/traces'
import { ModuleDebug } from './moduleDebug'

const isWindows = process.platform === 'win32'

export interface VitestModuleEvaluatorOptions {
  evaluatedModules?: VitestEvaluatedModules
  interopDefault?: boolean | undefined
  moduleExecutionInfo?: ModuleExecutionInfo
  getCurrentTestFilepath?: () => string | undefined
  compiledFunctionArgumentsNames?: string[]
  compiledFunctionArgumentsValues?: unknown[]
  /**
   * @internal
   */
  traces?: Traces
}

export class VitestModuleEvaluator implements ModuleEvaluator {
  public stubs: Record<string, any> = {}
  public env: ModuleRunnerImportMeta['env'] = createImportMetaEnvProxy()
  private vm: VitestVmOptions | undefined

  private compiledFunctionArgumentsNames?: string[]
  private compiledFunctionArgumentsValues: unknown[] = []

  private primitives: {
    Object: typeof Object
    Proxy: typeof Proxy
    Reflect: typeof Reflect
  }

  private debug = new ModuleDebug()
  private _otel: Traces
  private _evaluatedModules?: VitestEvaluatedModules

  constructor(
    vmOptions?: VitestVmOptions | undefined,
    private options: VitestModuleEvaluatorOptions = {},
  ) {
    this._otel = options.traces || new Traces({ enabled: false })
    this.vm = vmOptions
    this.stubs = getDefaultRequestStubs(vmOptions?.context)
    this._evaluatedModules = options.evaluatedModules
    if (options.compiledFunctionArgumentsNames) {
      this.compiledFunctionArgumentsNames = options.compiledFunctionArgumentsNames
    }
    if (options.compiledFunctionArgumentsValues) {
      this.compiledFunctionArgumentsValues = options.compiledFunctionArgumentsValues
    }
    if (vmOptions) {
      this.primitives = vm.runInContext(
        '({ Object, Proxy, Reflect })',
        vmOptions.context,
      )
    }
    else {
      this.primitives = {
        Object,
        Proxy,
        Reflect,
      }
    }
  }

  private convertIdToImportUrl(id: string) {
    // TODO: vitest returns paths for external modules, but Vite returns file://
    // REMOVE WHEN VITE 6 SUPPORT IS OVER
    // unfortunetly, there is a bug in Vite where ID is resolved incorrectly, so we can't return files until the fix is merged
    // https://github.com/vitejs/vite/pull/20449
    if (!isWindows || isBuiltin(id) || /^(?:node:|data:|http:|https:|file:)/.test(id)) {
      return id
    }
    const [filepath, query] = id.split('?')
    if (query) {
      return `${pathToFileURL(filepath).toString()}?${query}`
    }
    return pathToFileURL(filepath).toString()
  }

  async runExternalModule(id: string): Promise<any> {
    if (id in this.stubs) {
      return this.stubs[id]
    }

    const file = this.convertIdToImportUrl(id)

    // this will always be 1 element because it's cached after load
    const importers = this._evaluatedModules?.getModuleById(id)?.importers
    const importer = importers?.values().next().value
    const filename = id.startsWith('file://') ? fileURLToPath(id) : id
    const finishModuleExecutionInfo = this.debug.startCalculateModuleExecutionInfo(
      filename,
      {
        startOffset: 0,
        external: true,
        importer,
      },
    )
    const namespace = await this._otel.$(
      'vitest.module.external',
      {
        attributes: { 'code.file.path': file },
      },
      () => this.vm
        ? this.vm.externalModulesExecutor.import(file)
        : import(file),
    ).finally(() => {
      this.options.moduleExecutionInfo?.set(filename, finishModuleExecutionInfo())
    })

    if (!this.shouldInterop(file, namespace)) {
      return namespace
    }

    const { mod, defaultExport } = interopModule(namespace)
    const { Proxy, Reflect } = this.primitives

    const proxy = new Proxy(mod, {
      get(mod, prop) {
        if (prop === 'default') {
          return defaultExport
        }
        return mod[prop] ?? defaultExport?.[prop]
      },
      has(mod, prop) {
        if (prop === 'default') {
          return defaultExport !== undefined
        }
        return prop in mod || (defaultExport && prop in defaultExport)
      },
      getOwnPropertyDescriptor(mod, prop) {
        const descriptor = Reflect.getOwnPropertyDescriptor(mod, prop)
        if (descriptor) {
          return descriptor
        }
        if (prop === 'default' && defaultExport !== undefined) {
          return {
            value: defaultExport,
            enumerable: true,
            configurable: true,
          }
        }
      },
    })
    return proxy
  }

  async runInlinedModule(
    context: ModuleRunnerContext,
    code: string,
    module: Readonly<EvaluatedModuleNode>,
  ): Promise<any> {
    return this._otel.$(
      'vitest.module.inline',
      span => this._runInlinedModule(context, code, module, span),
    )
  }

  private _createCJSGlobals(
    context: ModuleRunnerContext,
    module: Readonly<EvaluatedModuleNode>,
    span: Span,
  ) {
    const { Reflect, Proxy, Object } = this.primitives

    const exportsObject = context[ssrModuleExportsKey]
    const SYMBOL_NOT_DEFINED = Symbol('not defined')
    let moduleExports: unknown = SYMBOL_NOT_DEFINED
    // this proxy is triggered only on exports.{name} and module.exports access
    // inside the module itself. imported module is always "exports"
    const cjsExports = new Proxy(exportsObject, {
      get: (target, p, receiver) => {
        if (Reflect.has(target, p)) {
          return Reflect.get(target, p, receiver)
        }
        return Reflect.get(Object.prototype, p, receiver)
      },
      getPrototypeOf: () => Object.prototype,
      set: (_, p, value) => {
        span.addEvent(`cjs export proxy is triggered for ${String(p)}`)
        // treat "module.exports =" the same as "exports.default =" to not have nested "default.default",
        // so "exports.default" becomes the actual module
        if (
          p === 'default'
          && this.shouldInterop(module.file, { default: value })
          && cjsExports !== value
        ) {
          span.addEvent('`exports.default` is assigned, copying values')
          exportAll(cjsExports, value)
          exportsObject.default = value
          return true
        }

        if (!Reflect.has(exportsObject, 'default')) {
          exportsObject.default = {}
        }

        // returns undefined, when accessing named exports, if default is not an object
        // but is still present inside hasOwnKeys, this is Node behaviour for CJS
        if (
          moduleExports !== SYMBOL_NOT_DEFINED
          && isPrimitive(moduleExports)
        ) {
          span.addEvent(`\`exports.${String(p)}\` is assigned, but module.exports is a primitive. assigning "undefined" values instead to comply with ESM`)
          defineExport(exportsObject, p, () => undefined)
          return true
        }

        if (!isPrimitive(exportsObject.default)) {
          exportsObject.default[p] = value
        }

        if (p !== 'default') {
          defineExport(exportsObject, p, () => value)
        }

        return true
      },
    })

    const moduleProxy = {
      set exports(value) {
        span.addEvent('`module.exports` is assigned directly, copying all properties to `exports`')
        exportAll(cjsExports, value)
        exportsObject.default = value
        moduleExports = value
      },
      get exports() {
        return cjsExports
      },
    }

    const require = this.createRequire(context[ssrImportMetaKey].url)

    return {
      exports: cjsExports,
      module: moduleProxy,
      require,
      __filename: context[ssrImportMetaKey].filename,
      __dirname: context[ssrImportMetaKey].dirname,
    }
  }

  private async _runInlinedModule(
    context: ModuleRunnerContext,
    code: string,
    module: Readonly<EvaluatedModuleNode>,
    span: Span,
  ): Promise<any> {
    const meta = context[ssrImportMetaKey]
    meta.env = this.env

    const testFilepath = this.options.getCurrentTestFilepath?.()
    if (testFilepath === module.file) {
      const globalNamespace = this.vm?.context || globalThis
      Object.defineProperty(meta, 'vitest', {
        // @ts-expect-error injected untyped global
        get: () => globalNamespace.__vitest_index__,
      })
    }

    span.setAttribute('code.file.path', meta.filename)

    const argumentsList = [
      ssrModuleExportsKey,
      ssrImportMetaKey,
      ssrImportKey,
      ssrDynamicImportKey,
      ssrExportAllKey,
      // vite 7 support
      '__vite_ssr_exportName__',
    ]

    const cjsGlobals = this._createCJSGlobals(context, module, span)
    argumentsList.push(
      // TODO@discuss deprecate in Vitest 5, remove in Vitest 6(?)
      // backwards compat for vite-node
      '__filename',
      '__dirname',
      'module',
      'exports',
      'require',
    )

    if (this.compiledFunctionArgumentsNames) {
      argumentsList.push(...this.compiledFunctionArgumentsNames)
    }

    span.setAttribute('vitest.module.arguments', argumentsList)

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${argumentsList.join(
      ',',
    )})=>{{`
    const wrappedCode = `${codeDefinition}${code}\n}}`
    const options = {
      // use original id for auto spy module (vi.mock(..., { spy: true }))
      filename: module.id.startsWith('mock:') ? module.id.slice(5) : module.id,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    // this will always be 1 element because it's cached after load
    const importer = module.importers.values().next().value
    const finishModuleExecutionInfo = this.debug.startCalculateModuleExecutionInfo(options.filename, {
      startOffset: codeDefinition.length,
      importer,
    })

    try {
      const initModule = this.vm
        ? vm.runInContext(wrappedCode, this.vm.context, options)
        : vm.runInThisContext(wrappedCode, options)

      await initModule(
        context[ssrModuleExportsKey],
        context[ssrImportMetaKey],
        context[ssrImportKey],
        context[ssrDynamicImportKey],
        context[ssrExportAllKey],
        // vite 7 support, remove when vite 7+ is supported
        context.__vite_ssr_exportName__
        || ((name: string, getter: () => unknown) => Object.defineProperty(context[ssrModuleExportsKey], name, {
          enumerable: true,
          configurable: true,
          get: getter,
        })),

        cjsGlobals.__filename,
        cjsGlobals.__dirname,
        cjsGlobals.module,
        cjsGlobals.exports,
        cjsGlobals.require,

        ...this.compiledFunctionArgumentsValues,
      )
    }
    finally {
      // moduleExecutionInfo needs to use Node filename instead of the normalized one
      // because we rely on this behaviour in coverage-v8, for example
      this.options.moduleExecutionInfo?.set(options.filename, finishModuleExecutionInfo())
    }
  }

  private createRequire(url: string) {
    if (url.startsWith('data:')) {
      const _require = (id: string) => {
        throw new SyntaxError(`require() is not supported in virtual modules. Trying to call require("${id}") in ${url}`)
      }
      _require.resolve = _require
      return _require
    }
    return this.vm
      ? this.vm.externalModulesExecutor.createRequire(url)
      : createRequire(url)
  }

  private shouldInterop(path: string, mod: any): boolean {
    if (this.options.interopDefault === false) {
      return false
    }
    // never interop ESM modules
    // TODO: should also skip for `.js` with `type="module"`
    return !path.endsWith('.mjs') && 'default' in mod
  }
}

export function createImportMetaEnvProxy(): ModuleRunnerImportMeta['env'] {
  // packages/vitest/src/node/plugins/index.ts:146
  const booleanKeys = ['DEV', 'PROD', 'SSR']
  return new Proxy(process.env, {
    get(_, key) {
      if (typeof key !== 'string') {
        return undefined
      }
      if (booleanKeys.includes(key)) {
        return !!process.env[key]
      }
      return process.env[key]
    },
    set(_, key, value) {
      if (typeof key !== 'string') {
        return true
      }

      if (booleanKeys.includes(key)) {
        process.env[key] = value ? '1' : ''
      }
      else {
        process.env[key] = value
      }

      return true
    },
  }) as ModuleRunnerImportMeta['env']
}

function updateStyle(id: string, css: string) {
  if (typeof document === 'undefined') {
    return
  }

  const element = document.querySelector(`[data-vite-dev-id="${id}"]`)
  if (element) {
    element.textContent = css
    return
  }

  const head = document.querySelector('head')
  const style = document.createElement('style')
  style.setAttribute('type', 'text/css')
  style.setAttribute('data-vite-dev-id', id)
  style.textContent = css
  head?.appendChild(style)
}

function removeStyle(id: string) {
  if (typeof document === 'undefined') {
    return
  }
  const sheet = document.querySelector(`[data-vite-dev-id="${id}"]`)
  if (sheet) {
    document.head.removeChild(sheet)
  }
}

const defaultClientStub = {
  injectQuery: (id: string) => id,
  createHotContext: () => {
    return {
      accept: () => {},
      prune: () => {},
      dispose: () => {},
      decline: () => {},
      invalidate: () => {},
      on: () => {},
      send: () => {},
    }
  },
  updateStyle: () => {},
  removeStyle: () => {},
}

export function getDefaultRequestStubs(context?: vm.Context): Record<string, any> {
  if (!context) {
    const clientStub = {
      ...defaultClientStub,
      updateStyle,
      removeStyle,
    }
    return {
      '/@vite/client': clientStub,
    }
  }
  const clientStub = vm.runInContext(
    `(defaultClient) => ({ ...defaultClient, updateStyle: ${updateStyle.toString()}, removeStyle: ${removeStyle.toString()} })`,
    context,
  )(defaultClientStub)
  return {
    '/@vite/client': clientStub,
  }
}

function exportAll(exports: any, sourceModule: any) {
  // #1120 when a module exports itself it causes
  // call stack error
  if (exports === sourceModule) {
    return
  }

  if (
    isPrimitive(sourceModule)
    || Array.isArray(sourceModule)
    || sourceModule instanceof Promise
  ) {
    return
  }

  for (const key in sourceModule) {
    if (key !== 'default' && !(key in exports)) {
      try {
        defineExport(exports, key, () => sourceModule[key])
      }
      catch {}
    }
  }
}

// keep consistency with Vite on how exports are defined
function defineExport(exports: any, key: string | symbol, value: () => any) {
  Object.defineProperty(exports, key, {
    enumerable: true,
    configurable: true,
    get: value,
  })
}

export function isPrimitive(v: any): boolean {
  const isObject = typeof v === 'object' || typeof v === 'function'
  return !isObject || v == null
}

function interopModule(mod: any) {
  if (isPrimitive(mod)) {
    return {
      mod: { default: mod },
      defaultExport: mod,
    }
  }

  let defaultExport = 'default' in mod ? mod.default : mod

  if (!isPrimitive(defaultExport) && '__esModule' in defaultExport) {
    mod = defaultExport
    if ('default' in defaultExport) {
      defaultExport = defaultExport.default
    }
  }

  return { mod, defaultExport }
}

const VALID_ID_PREFIX = `/@id/`
const NULL_BYTE_PLACEHOLDER = `__x00__`

export function wrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id
    : VALID_ID_PREFIX + id.replace('\0', NULL_BYTE_PLACEHOLDER)
}

export function unwrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, '\0')
    : id
}
