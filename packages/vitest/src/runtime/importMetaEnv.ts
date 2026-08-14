import type { MetaEnv } from '../types/worker'

// packages/vitest/src/node/plugins/index.ts:146
const booleanKeys = ['DEV', 'PROD', 'SSR']

/**
 * `import.meta.env` is a view over `process.env`, not a copy of it. Every trap
 * reads `process.env` again instead of the proxy target because test code can
 * replace the whole object (`process.env = {}`), which leaves the target
 * pointing at the detached one.
 */
export function createImportMetaEnvProxy(): MetaEnv {
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
    deleteProperty(_, key) {
      if (typeof key !== 'string') {
        return true
      }

      delete process.env[key]

      return true
    },
    has(_, key) {
      if (typeof key !== 'string') {
        return false
      }
      return key in process.env
    },
    ownKeys() {
      return Reflect.ownKeys(process.env)
    },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || !Object.hasOwn(process.env, key)) {
        return undefined
      }
      return {
        value: booleanKeys.includes(key)
          ? !!process.env[key]
          : process.env[key],
        writable: true,
        enumerable: true,
        configurable: true,
      }
    },
  }) as MetaEnv
}
