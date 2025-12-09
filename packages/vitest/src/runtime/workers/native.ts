import type { SourceMap } from 'node:module'
import type { WorkerSetupContext } from '../../types/worker'
import module from 'node:module'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'
import MagicString from 'magic-string'
import { resolve } from 'pathe'

export function setupNodeLoaderHooks(worker: WorkerSetupContext): void {
  module.setSourceMapsSupport(true)

  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context)
        // avoid node_modules for performance reasons
        if (context.parentURL && result.url && !result.url.includes('/node_modules/')) {
          worker.rpc.ensureModuleGraphEntry(result.url, context.parentURL).catch(() => {
            // ignore the errors if any
          })
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

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
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
    ms().prepend(`const IMPORT_META_VITEST = typeof __vitest_worker__ !== 'undefined' && __vitest_worker__.filepath === "${filename.replace(/"/g, '\\"')}" ? __vitest_index__ : undefined;\n`)
  }
}

function createLoadHook(_worker: WorkerSetupContext): module.LoadHookSync {
  return (url, context, nextLoad) => {
    const result = nextLoad(url, context)
    // ignore node_modules for performance reasons
    if (url.includes('/node_modules/')) {
      return result
    }
    // TODO: technically, we know every file that has import.meta.vitest inside already
    // it is collected in project#isInSourceTestCode - we just need to pass the down,
    // then we don't need to stringify the source, which is better for performance
    const source = result.source?.toString()
    if (typeof source === 'string') {
      let _ms: MagicString | undefined
      const ms = () => _ms || (_ms = new MagicString(source))

      if (source.includes('import.meta.vitest')) {
        replaceInSourceMarker(url, source, ms)
      }

      let code: string
      if (_ms) {
        const filename = fileURLToPath(url)
        const string = _ms.toString()
        const map = _ms.generateMap({ hires: 'boundary', source: filename })
        // TODO - extract the one that might've been there already
        code = `${string}\n//# sourceMappingURL=${genSourceMapUrl(map as any)}`
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
