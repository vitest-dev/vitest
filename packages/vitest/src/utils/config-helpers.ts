import type {
  BenchmarkBuiltinReporters,
  BuiltinReporters,
} from '../node/reporters'
import type { SerializedConfig } from '../node/types/config'

const REGEXP_WRAP_PREFIX = '$$vitest:'

interface PotentialConfig {
  outputFile?: string | Partial<Record<string, string>>
}

export function getOutputFile(
  config: PotentialConfig | undefined,
  reporter: BuiltinReporters | BenchmarkBuiltinReporters | 'html',
): string | undefined {
  if (!config?.outputFile) {
    return
  }

  if (typeof config.outputFile === 'string') {
    return config.outputFile
  }

  return config.outputFile[reporter]
}

/**
 * Prepares `SerializedConfig` for serialization, e.g. `node:v8.serialize`
 */
export function wrapSerializableConfig(config: SerializedConfig) {
  let testNamePattern = config.testNamePattern
  let defines = config.defines

  // v8 serialize does not support regex
  if (testNamePattern && typeof testNamePattern !== 'string') {
    testNamePattern
      = `${REGEXP_WRAP_PREFIX}${testNamePattern.toString()}` as unknown as RegExp
  }

  // v8 serialize drops properties with undefined value
  if (defines) {
    defines = { keys: Object.keys(defines), original: defines }
  }

  return {
    ...config,
    testNamePattern,
    defines,
  } as SerializedConfig
}

/**
 * Like `JSON.stringify` but keeps raw string values as a literal
 * in the generated code. For example: `"window"` would refer to
 * the global `window` object directly.
 */
export function serializeDefine(define: Record<string, any>): string {
  const userDefine: Record<string, any> = {}
  for (const key in define) {
    // import.meta.env.* is handled in `importAnalysis` plugin
    if (!key.startsWith('import.meta.env.')) {
      userDefine[key] = define[key]
    }
  }
  let res = `{`
  const keys = Object.keys(userDefine).sort()
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const val = userDefine[key]
    res += `${JSON.stringify(key)}: ${handleDefineValue(val)}`
    if (i !== keys.length - 1) {
      res += `, `
    }
  }
  return `${res}}`
}

export function createDefinesScript(define: Record<string, any> | undefined): string {
  if (!define) {
    return ''
  }
  return `
const defines = ${serializeDefine(define)}
Object.keys(defines).forEach((key) => {
  const segments = key.split('.')
  let target = globalThis
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (i === segments.length - 1) {
      target[segment] = defines[key]
    } else {
      target = target[segment] || (target[segment] = {})
    }
  }
})
  `
}

function handleDefineValue(value: any): string {
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}
