import type {
  BenchmarkBuiltinReporters,
  BuiltinReporters,
} from '../node/reporters'

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

export function createDefinesScript(define: Record<string, any> | undefined): string {
  if (!define) {
    return ''
  }
  const serializedDefine = serializeDefine(define)
  if (serializedDefine === '{}') {
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

/**
 * Like `JSON.stringify` but keeps raw string values as a literal
 * in the generated code. For example: `"window"` would refer to
 * the global `window` object directly.
 */
function serializeDefine(define: Record<string, any>): string {
  const userDefine: Record<string, any> = {}
  for (const key in define) {
    // vitest sets this to avoid vite:client-inject plugin
    if (key === 'process.env.NODE_ENV' && define[key] === 'process.env.NODE_ENV') {
      continue
    }
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

function handleDefineValue(value: any): string {
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}
