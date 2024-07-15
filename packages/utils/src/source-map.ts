import { resolve } from 'pathe'
import type { SourceMapInput } from '@jridgewell/trace-mapping'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import type { ErrorWithDiff, ParsedStack } from './types'
import { isPrimitive, notNullish } from './helpers'

export {
  TraceMap,
  originalPositionFor,
  generatedPositionFor,
} from '@jridgewell/trace-mapping'
export type { SourceMapInput } from '@jridgewell/trace-mapping'

export interface StackTraceParserOptions {
  ignoreStackEntries?: (RegExp | string)[]
  getSourceMap?: (file: string) => unknown
  getFileName?: (id: string) => string
  frameFilter?: (error: Error, frame: ParsedStack) => boolean | void
}

const CHROME_IE_STACK_REGEXP = /^\s*at .*(?:\S:\d+|\(native\))/m
const SAFARI_NATIVE_CODE_REGEXP = /^(?:eval@)?(?:\[native code\])?$/

const stackIgnorePatterns = [
  'node:internal',
  /\/packages\/\w+\/dist\//,
  /\/@vitest\/\w+\/dist\//,
  '/vitest/dist/',
  '/vitest/src/',
  '/vite-node/dist/',
  '/vite-node/src/',
  '/node_modules/chai/',
  '/node_modules/tinypool/',
  '/node_modules/tinyspy/',
  // browser related deps
  '/deps/chunk-',
  '/deps/@vitest',
  '/deps/loupe',
  '/deps/chai',
  /node:\w+/,
  /__vitest_test__/,
  /__vitest_browser__/,
  /\/deps\/vitest_/,
]

function prepareUrl(urlLike: string) {
  let url = urlLike
  if (url.startsWith('async ')) {
    url = url.slice(6)
  }
  if (url.startsWith('http:') || url.startsWith('https:')) {
    const urlObj = new URL(url)
    url = urlObj.pathname
  }
  if (url.startsWith('/@fs/')) {
    const isWindows = /^\/@fs\/[a-zA-Z]:\//.test(url)
    url = url.slice(isWindows ? 5 : 4)
  }
  return url
}

function extractLocation(urlLike: string) {
  // Fail-fast but return locations like "(native)"
  if (!urlLike.includes(':')) {
    return [urlLike]
  }

  const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
  const parts = regExp.exec(urlLike.replace(/^\(|\)$/g, ''))
  return parts
    ? [prepareUrl(parts[1]), parts[2] || undefined, parts[3] || undefined]
    : [urlLike]
}

export function parseSingleFFOrSafariStack(raw: string): ParsedStack | null {
  let line = raw.trim()

  if (SAFARI_NATIVE_CODE_REGEXP.test(line)) {
    return null
  }

  if (line.includes(' > eval')) {
    line = line.replace(
      / line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,
      ':$1',
    )
  }

  if (!line.includes('@') && !line.includes(':')) {
    return null
  }

  // eslint-disable-next-line regexp/no-useless-assertions,regexp/no-unused-capturing-group
  const matches = /^(\bat\s*\b)?(?:\b\s*async\s*\b)?(\b\w+(?!([/:@]|(https?)|(file)))\b)?(?:@|\s+\()?([^\s()]+):(\d+):(\d+)\)?$/.exec(line)
  if (!matches) {
    return null
  }

  return {
    file: prepareUrl(matches[6]),
    method: matches[2] || '',
    line: Number.parseInt(matches[7]),
    column: Number.parseInt(matches[8]),
  }
}

export function parseSingleStack(raw: string) {
  const line = raw.trim()
  if (!CHROME_IE_STACK_REGEXP.test(line)) {
    return parseSingleFFOrSafariStack(line)
  }
  return parseSingleV8Stack(line)
}

// Based on https://github.com/stacktracejs/error-stack-parser
// Credit to stacktracejs
export function parseSingleV8Stack(raw: string): ParsedStack | null {
  let line = raw.trim()

  if (!CHROME_IE_STACK_REGEXP.test(line)) {
    return null
  }

  if (line.includes('(eval ')) {
    line = line
      .replace(/eval code/g, 'eval')
      .replace(/(\(eval at [^()]*)|(,.*$)/g, '')
  }

  let sanitizedLine = line
    .replace(/^\s+/, '')
    .replace(/\(eval code/g, '(')
    .replace(/^.*?\s+/, '')

  // capture and preserve the parenthesized location "(/foo/my bar.js:12:87)" in
  // case it has spaces in it, as the string is split on \s+ later on
  const location = sanitizedLine.match(/ (\(.+\)$)/)

  // remove the parenthesized location from the line, if it was matched
  sanitizedLine = location
    ? sanitizedLine.replace(location[0], '')
    : sanitizedLine

  // if a location was matched, pass it to extractLocation() otherwise pass all sanitizedLine
  // because this line doesn't have function name
  const [url, lineNumber, columnNumber] = extractLocation(
    location ? location[1] : sanitizedLine,
  )
  let method = (location && sanitizedLine) || ''
  let file = url && ['eval', '<anonymous>'].includes(url) ? undefined : url

  if (!file || !lineNumber || !columnNumber) {
    return null
  }

  if (method.startsWith('async ')) {
    method = method.slice(6)
  }

  if (file.startsWith('file://')) {
    file = file.slice(7)
  }

  // normalize Windows path (\ -> /)
  file = resolve(file)

  if (method) {
    method = method.replace(/__vite_ssr_import_\d+__\./g, '')
  }

  return {
    method,
    file,
    line: Number.parseInt(lineNumber),
    column: Number.parseInt(columnNumber),
  }
}

export function parseStacktrace(
  stack: string,
  options: StackTraceParserOptions = {},
): ParsedStack[] {
  const { ignoreStackEntries = stackIgnorePatterns } = options
  let stacks = !CHROME_IE_STACK_REGEXP.test(stack)
    ? parseFFOrSafariStackTrace(stack)
    : parseV8Stacktrace(stack)
  if (ignoreStackEntries.length) {
    stacks = stacks.filter(
      stack => !ignoreStackEntries.some(p => stack.file.match(p)),
    )
  }
  return stacks.map((stack) => {
    if (options.getFileName) {
      stack.file = options.getFileName(stack.file)
    }

    const map = options.getSourceMap?.(stack.file) as
      | SourceMapInput
      | null
      | undefined
    if (!map || typeof map !== 'object' || !map.version) {
      return stack
    }
    const traceMap = new TraceMap(map)
    const { line, column } = originalPositionFor(traceMap, stack)
    if (line != null && column != null) {
      return { ...stack, line, column }
    }
    return stack
  })
}

function parseFFOrSafariStackTrace(stack: string): ParsedStack[] {
  return stack
    .split('\n')
    .map(line => parseSingleFFOrSafariStack(line))
    .filter(notNullish)
}

function parseV8Stacktrace(stack: string): ParsedStack[] {
  return stack
    .split('\n')
    .map(line => parseSingleV8Stack(line))
    .filter(notNullish)
}

export function parseErrorStacktrace(
  e: ErrorWithDiff,
  options: StackTraceParserOptions = {},
): ParsedStack[] {
  if (!e || isPrimitive(e)) {
    return []
  }

  if (e.stacks) {
    return e.stacks
  }

  const stackStr = e.stack || e.stackStr || ''
  let stackFrames = parseStacktrace(stackStr, options)

  if (options.frameFilter) {
    stackFrames = stackFrames.filter(
      f => options.frameFilter!(e, f) !== false,
    )
  }

  e.stacks = stackFrames
  return stackFrames
}
