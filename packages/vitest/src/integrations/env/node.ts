import type { Environment } from '../../types/environment'
import { Console } from 'node:console'

// some globals we do not want, either because deprecated or we set it ourselves
const denyList = new Set([
  'GLOBAL',
  'root',
  'global',
  'Buffer',
  'ArrayBuffer',
  'Uint8Array',
])

const nodeGlobals = new Map(
  Object.getOwnPropertyNames(globalThis)
    .filter(global => !denyList.has(global))
    .map((nodeGlobalsKey) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        nodeGlobalsKey,
      )

      if (!descriptor) {
        throw new Error(
          `No property descriptor for ${nodeGlobalsKey}, this is a bug in Vitest.`,
        )
      }

      return [nodeGlobalsKey, descriptor]
    }),
)

export default <Environment>{
  name: 'node',
  transformMode: 'ssr',
  // this is largely copied from jest's node environment
  async setupVM() {
    const vm = await import('node:vm')
    let context = vm.createContext()
    let global = vm.runInContext('this', context)

    const contextGlobals = new Set(Object.getOwnPropertyNames(global))
    for (const [nodeGlobalsKey, descriptor] of nodeGlobals) {
      if (!contextGlobals.has(nodeGlobalsKey)) {
        if (descriptor.configurable) {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() {
              // @ts-expect-error: no index signature
              const val = globalThis[nodeGlobalsKey] as unknown

              // override lazy getter
              Object.defineProperty(global, nodeGlobalsKey, {
                configurable: true,
                enumerable: descriptor.enumerable,
                value: val,
                writable:
                  descriptor.writable === true
                  // Node 19 makes performance non-readable. This is probably not the correct solution.
                  || nodeGlobalsKey === 'performance',
              })
              return val
            },
            set(val: unknown) {
              // override lazy getter
              Object.defineProperty(global, nodeGlobalsKey, {
                configurable: true,
                enumerable: descriptor.enumerable,
                value: val,
                writable: true,
              })
            },
          })
        }
        else if ('value' in descriptor) {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: false,
            enumerable: descriptor.enumerable,
            value: descriptor.value,
            writable: descriptor.writable,
          })
        }
        else {
          Object.defineProperty(global, nodeGlobalsKey, {
            configurable: false,
            enumerable: descriptor.enumerable,
            get: descriptor.get,
            set: descriptor.set,
          })
        }
      }
    }

    global.global = global
    global.Buffer = Buffer
    global.ArrayBuffer = ArrayBuffer
    // TextEncoder (global or via 'util') references a Uint8Array constructor
    // different than the global one used by users in tests. This makes sure the
    // same constructor is referenced by both.
    global.Uint8Array = Uint8Array

    return {
      getVmContext() {
        return context
      },
      teardown() {
        context = undefined as any
        global = undefined
      },
    }
  },
  async setup(global) {
    global.console.Console = Console
    return {
      teardown(global) {
        delete global.console.Console
      },
    }
  },
}
