import type {
  EvaluatedModuleNode,
  ModuleEvaluator,
  ModuleRunnerContext,
  ModuleRunnerImportMeta,
} from 'vite/module-runner'
import type { VitestVmOptions } from './moduleRunner'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import {
  ESModulesEvaluator,
  ssrDynamicImportKey,
  ssrExportAllKey,
  ssrImportKey,
  ssrImportMetaKey,
  ssrModuleExportsKey,
} from 'vite/module-runner'

export const AsyncFunction = async function () {}.constructor as typeof Function

export interface VitestModuleEvaluatorOptions {
  interopDefault: boolean | undefined
  getCurrentTestFilepath: () => string | undefined
}

export class VitestModuleEvaluator implements ModuleEvaluator {
  private defaultEvaluator = new ESModulesEvaluator()
  public readonly startOffset: number
  public stubs: Record<string, any> = {}
  public env: ModuleRunnerImportMeta['env'] = createImportMetaEnvProxy()

  constructor(
    private vm: VitestVmOptions | undefined,
    private options: VitestModuleEvaluatorOptions,
  ) {
    this.startOffset = this.defaultEvaluator.startOffset
    this.stubs = getDefaultRequestStubs(vm?.context)
  }

  runExternalModule(file: string): Promise<any> {
    if (file in this.stubs) {
      return this.stubs[file]
    }

    if (this.vm) {
      return this.vm.externalModulesExecutor.import(file)
    }

    return this.defaultEvaluator.runExternalModule(file)
  }

  async runInlinedModule(
    context: ModuleRunnerContext,
    code: string,
    module: Readonly<EvaluatedModuleNode>,
  ): Promise<any> {
    context.__vite_ssr_import_meta__.env = this.env

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
        // treat "module.exports =" the same as "exports.default =" to not have nested "default.default",
        // so "exports.default" becomes the actual module
        if (
          p === 'default'
          && this.shouldInterop(module.file, { default: value })
          && cjsExports !== value
        ) {
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
        exportAll(cjsExports, value)
        exportsObject.default = value
        moduleExports = value
      },
      get exports() {
        return cjsExports
      },
    }

    const meta = context[ssrImportMetaKey]

    const testFilepath = this.options.getCurrentTestFilepath()
    if (testFilepath === meta.filename) {
      const globalNamespace = this.vm?.context || globalThis
      Object.defineProperty(meta, 'vitest', {
        // @ts-expect-error injected untyped global
        get: () => globalNamespace.__vitest_index__,
      })
    }

    const filename = meta.filename
    const dirname = meta.dirname

    const require = this.vm
      ? this.vm.externalModulesExecutor.createRequire(filename)
      : createRequire(filename)

    const argumentsList = [
      ssrModuleExportsKey,
      ssrImportMetaKey,
      ssrImportKey,
      ssrDynamicImportKey,
      ssrExportAllKey,
      // vite 7 support
      '__vite_ssr_exportName__',

      // backwards compat for vite-node
      '__filename',
      '__dirname',
      'module',
      'exports',
      'require',
    ]

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${argumentsList.join(
      ',',
    )})=>{{`
    const wrappedCode = `${codeDefinition}${code}\n}}`
    const options = {
      filename,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    // TODO
    // const finishModuleExecutionInfo = this.startCalculateModuleExecutionInfo(options.filename, codeDefinition.length)

    const initModule = this.vm
      ? vm.runInContext(wrappedCode, this.vm.context, options)
      : vm.runInThisContext(
          wrappedCode,
          options,
        )

    await initModule(
      context[ssrModuleExportsKey],
      context[ssrImportMetaKey],
      context[ssrImportKey],
      context[ssrDynamicImportKey],
      context[ssrExportAllKey],
      // vite 7 support
      (name: string, getter: () => unknown) => Object.defineProperty(moduleExports, name, {
        enumerable: true,
        configurable: true,
        get: getter,
      }),

      filename,
      dirname,
      moduleProxy,
      cjsExports,
      require,
    )
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
