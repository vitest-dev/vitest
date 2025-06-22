import type { EvaluatedModuleNode, ModuleEvaluator, ModuleRunnerContext, ModuleRunnerImportMeta } from 'vite/module-runner'
import type { VitestVmOptions } from './moduleRunner'
import vm from 'node:vm'
import { ESModulesEvaluator } from 'vite/module-runner'

export class VitestModuleEvaluator implements ModuleEvaluator {
  private defaultEvaluator = new ESModulesEvaluator()
  public readonly startOffset: number
  public stubs: Record<string, any> = {}
  public env: ModuleRunnerImportMeta['env'] = createImportMetaEnvProxy()

  constructor(
    private vm: VitestVmOptions | undefined,
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

  async runInlinedModule(context: ModuleRunnerContext, code: string, module: Readonly<EvaluatedModuleNode>): Promise<any> {
    context.__vite_ssr_import_meta__.env = this.env

    if (this.vm) {
      return this.runVmModule(context, code, module)
    }
    // TODO: support mocker
    return this.defaultEvaluator.runInlinedModule(context, code)
  }

  private async runVmModule(context: ModuleRunnerContext, code: string, module: Readonly<EvaluatedModuleNode>) {
    if (!this.vm) {
      throw new Error(`"runVmModule" requires this.vm to be set.`)
    }

    // add 'use strict' since ESM enables it by default
    const codeDefinition = `'use strict';async (${Object.keys(context).join(
      ',',
    )})=>{{`
    const wrappedCode = `${codeDefinition}${code}\n}}`
    const options = {
      filename: module.file,
      lineOffset: 0,
      columnOffset: -codeDefinition.length,
    }

    // TODO
    // const finishModuleExecutionInfo = this.startCalculateModuleExecutionInfo(options.filename, codeDefinition.length)

    try {
      const fn = vm.runInContext(wrappedCode, this.vm.context, {
        ...options,
        // if we encountered an import, it's not inlined
        importModuleDynamically: this.vm.externalModulesExecutor
          .importModuleDynamically,
      } as any)
      await fn(...Object.values(context))
    }
    finally {
      // this.options.moduleExecutionInfo?.set(options.filename, finishModuleExecutionInfo())
    }
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

function getDefaultRequestStubs(context?: vm.Context) {
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
