// adapted from https://github.com/evanw/node-source-map-support/blob/master/source-map-support.js
// we need this because "--enable-source-maps" flag doesn't support VM
// we make a custom implementatin because we don't need some features from source-map-support,
// like polyfilled Buffer, browser support, etc.

import type {
  OriginalMapping,
  SourceMapInput,
} from '@jridgewell/trace-mapping'
import fs from 'node:fs'
import path from 'node:path'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { sourceMapCache } from './source-map-cache'

// Only install once if called multiple times
let errorFormatterInstalled = false

// Maps a file path to a string containing the file contents
const fileContentsCache: Record<string, string> = {}

// Regex for detecting source maps
const reSourceMap = /^data:application\/json[^,]+base64,/

type RetrieveFileHandler = (path: string) => string | null | undefined
type RetrieveMapHandler = (
  source: string
) => { url: string; map?: string | SourceMapInput | null } | null | undefined

// Priority list of retrieve handlers
let retrieveFileHandlers: RetrieveFileHandler[] = []
let retrieveMapHandlers: RetrieveMapHandler[] = []

function globalProcessVersion() {
  if (typeof process === 'object' && process !== null) {
    return process.version
  }
  else {
    return ''
  }
}

function handlerExec<T>(list: ((arg: string) => T)[]) {
  return function (arg: string) {
    for (let i = 0; i < list.length; i++) {
      const ret = list[i](arg)
      if (ret) {
        return ret
      }
    }
    return null
  }
}

let retrieveFile = handlerExec(retrieveFileHandlers)

retrieveFileHandlers.push((path) => {
  // Trim the path to make sure there is no extra whitespace.
  path = path.trim()
  if (path.startsWith('file:')) {
    // existsSync/readFileSync can't handle file protocol, but once stripped, it works
    path = path.replace(/file:\/\/\/(\w:)?/, (protocol, drive) => {
      return drive
        ? '' // file:///C:/dir/file -> C:/dir/file
        : '/' // file:///root-dir/file -> /root-dir/file
    })
  }
  if (path in fileContentsCache) {
    return fileContentsCache[path]
  }

  let contents = ''
  try {
    if (fs.existsSync(path)) {
      contents = fs.readFileSync(path, 'utf8')
    }
  }
  catch {
    /* ignore any errors */
  }

  return (fileContentsCache[path] = contents)
})

// Support URLs relative to a directory, but be careful about a protocol prefix
function supportRelativeURL(file: string, url: string) {
  if (!file) {
    return url
  }
  const dir = path.dirname(file)
  const match = /^\w+:\/\/[^/]*/.exec(dir)
  let protocol = match ? match[0] : ''
  const startPath = dir.slice(protocol.length)
  if (protocol && /^\/\w:/.test(startPath)) {
    // handle file:///C:/ paths
    protocol += '/'
    return (
      protocol
      + path.resolve(dir.slice(protocol.length), url).replace(/\\/g, '/')
    )
  }
  return protocol + path.resolve(dir.slice(protocol.length), url)
}

function retrieveSourceMapURL(source: string) {
  // Get the URL of the source map
  const fileData = retrieveFile(source)
  if (!fileData) {
    return null
  }
  const re
    = /\/\/[@#]\s*sourceMappingURL=([^\s'"]+)\s*$|\/\*[@#]\s*sourceMappingURL=[^\s*'"]+\s*\*\/\s*$/gm
  // Keep executing the search to find the *last* sourceMappingURL to avoid
  // picking up sourceMappingURLs from comments, strings, etc.
  let lastMatch, match
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(fileData))) {
    lastMatch = match
  }
  if (!lastMatch) {
    return null
  }
  return lastMatch[1]
}

// Can be overridden by the retrieveSourceMap option to install. Takes a
// generated source filename; returns a {map, optional url} object, or null if
// there is no source map.  The map field may be either a string or the parsed
// JSON object (ie, it must be a valid argument to the SourceMapConsumer
// constructor).
let retrieveSourceMap = handlerExec(retrieveMapHandlers)
retrieveMapHandlers.push((source) => {
  let sourceMappingURL = retrieveSourceMapURL(source)
  if (!sourceMappingURL) {
    return null
  }

  // Read the contents of the source map
  let sourceMapData
  if (reSourceMap.test(sourceMappingURL)) {
    // Support source map URL as a data url
    const rawData = sourceMappingURL.slice(sourceMappingURL.indexOf(',') + 1)
    sourceMapData = Buffer.from(rawData, 'base64').toString()
    sourceMappingURL = source
  }
  else {
    // Support source map URLs relative to the source URL
    sourceMappingURL = supportRelativeURL(source, sourceMappingURL)
    sourceMapData = retrieveFile(sourceMappingURL)
  }

  if (!sourceMapData) {
    return null
  }

  return {
    url: sourceMappingURL,
    map: sourceMapData,
  }
})

// interface Position {
//   source: string
//   line: number
//   column: number
// }

function mapSourcePosition(position: OriginalMapping) {
  if (!position.source) {
    return position
  }
  let sourceMap = sourceMapCache[position.source]
  if (!sourceMap) {
    // Call the (overridable) retrieveSourceMap function to get the source map.
    const urlAndMap = retrieveSourceMap(position.source)
    if (urlAndMap && urlAndMap.map) {
      sourceMap = sourceMapCache[position.source] = {
        url: urlAndMap.url,
        map: new TraceMap(urlAndMap.map),
      }

      // Load all sources stored inline with the source map into the file cache
      // to pretend like they are already loaded. They may not exist on disk.
      if (sourceMap.map?.sourcesContent) {
        sourceMap.map.sources.forEach((source, i) => {
          const contents = sourceMap.map?.sourcesContent?.[i]
          if (contents && source && sourceMap.url) {
            const url = supportRelativeURL(sourceMap.url, source)
            fileContentsCache[url] = contents
          }
        })
      }
    }
    else {
      sourceMap = sourceMapCache[position.source] = {
        url: null,
        map: null,
      }
    }
  }

  // Resolve the source URL relative to the URL of the source map
  if (sourceMap && sourceMap.map && sourceMap.url) {
    const originalPosition = originalPositionFor(sourceMap.map, position)

    // Only return the original position if a matching line was found. If no
    // matching line is found then we return position instead, which will cause
    // the stack trace to print the path and line for the compiled file. It is
    // better to give a precise location in the compiled file than a vague
    // location in the original file.
    if (originalPosition.source !== null) {
      originalPosition.source = supportRelativeURL(
        sourceMap.url,
        originalPosition.source,
      )
      return originalPosition
    }
  }

  return position
}

// Parses code generated by FormatEvalOrigin(), a function inside V8:
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js
function mapEvalOrigin(origin: string): string {
  // Most eval() calls are in this format
  let match = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin)
  if (match) {
    const position = mapSourcePosition({
      name: null,
      source: match[2],
      line: +match[3],
      column: +match[4] - 1,
    })
    return `eval at ${match[1]} (${position.source}:${position.line}:${
      position.column + 1
    })`
  }

  // Parse nested eval() calls using recursion
  match = /^eval at ([^(]+) \((.+)\)$/.exec(origin)
  if (match) {
    return `eval at ${match[1]} (${mapEvalOrigin(match[2])})`
  }

  // Make sure we still return useful information if we didn't find anything
  return origin
}

interface CallSite extends NodeJS.CallSite {
  getScriptNameOrSourceURL: () => string
}

// This is copied almost verbatim from the V8 source code at
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js. The
// implementation of wrapCallSite() used to just forward to the actual source
// code of CallSite.prototype.toString but unfortunately a new release of V8
// did something to the prototype chain and broke the shim. The only fix I
// could find was copy/paste.
function CallSiteToString(this: CallSite) {
  let fileName
  let fileLocation = ''
  if (this.isNative()) {
    fileLocation = 'native'
  }
  else {
    fileName = this.getScriptNameOrSourceURL()
    if (!fileName && this.isEval()) {
      fileLocation = this.getEvalOrigin() as string
      fileLocation += ', ' // Expecting source position to follow.
    }

    if (fileName) {
      fileLocation += fileName
    }
    else {
      // Source code does not originate from a file and is not native, but we
      // can still get the source position inside the source string, e.g. in
      // an eval string.
      fileLocation += '<anonymous>'
    }
    const lineNumber = this.getLineNumber()
    if (lineNumber != null) {
      fileLocation += `:${lineNumber}`
      const columnNumber = this.getColumnNumber()
      if (columnNumber) {
        fileLocation += `:${columnNumber}`
      }
    }
  }

  let line = ''
  const functionName = this.getFunctionName()
  let addSuffix = true
  const isConstructor = this.isConstructor()
  const isMethodCall = !(this.isToplevel() || isConstructor)
  if (isMethodCall) {
    let typeName = this.getTypeName()
    // Fixes shim to be backward compatible with Node v0 to v4
    if (typeName === '[object Object]') {
      typeName = 'null'
    }

    const methodName = this.getMethodName()
    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += `${typeName}.`
      }

      line += functionName
      if (
        methodName
        && functionName.indexOf(`.${methodName}`)
        !== functionName.length - methodName.length - 1
      ) {
        line += ` [as ${methodName}]`
      }
    }
    else {
      line += `${typeName}.${methodName || '<anonymous>'}`
    }
  }
  else if (isConstructor) {
    line += `new ${functionName || '<anonymous>'}`
  }
  else if (functionName) {
    line += functionName
  }
  else {
    line += fileLocation
    addSuffix = false
  }
  if (addSuffix) {
    line += ` (${fileLocation})`
  }

  return line
}

function cloneCallSite(frame: CallSite) {
  const object = {} as CallSite
  Object.getOwnPropertyNames(Object.getPrototypeOf(frame)).forEach((name) => {
    const key = name as keyof CallSite
    // @ts-expect-error difficult to type
    object[key] = /^(?:is|get)/.test(name)
      ? function () {
        // eslint-disable-next-line no-useless-call
        return frame[key].call(frame)
      }
      : frame[key]
  })
  object.toString = CallSiteToString
  return object
}

interface State {
  nextPosition: null | OriginalMapping
  curPosition: null | OriginalMapping
}

function wrapCallSite(frame: CallSite, state: State) {
  // provides interface backward compatibility
  if (state === undefined) {
    state = { nextPosition: null, curPosition: null }
  }

  if (frame.isNative()) {
    state.curPosition = null
    return frame
  }

  // Most call sites will return the source file from getFileName(), but code
  // passed to eval() ending in "//# sourceURL=..." will return the source file
  // from getScriptNameOrSourceURL() instead
  const source = frame.getFileName() || frame.getScriptNameOrSourceURL()
  if (source) {
    const line = frame.getLineNumber() as number
    let column = (frame.getColumnNumber() as number) - 1

    // Fix position in Node where some (internal) code is prepended.
    // See https://github.com/evanw/node-source-map-support/issues/36
    // Header removed in node at ^10.16 || >=11.11.0
    // v11 is not an LTS candidate, we can just test the one version with it.
    // Test node versions for: 10.16-19, 10.20+, 12-19, 20-99, 100+, or 11.11
    const noHeader
      = /^v(?:10\.1[6-9]|10\.[2-9]\d|10\.\d{3,}|1[2-9]\d*|[2-9]\d|\d{3,}|11\.11)/
    const headerLength = noHeader.test(globalProcessVersion()) ? 0 : 62
    if (line === 1 && column > headerLength && !frame.isEval()) {
      column -= headerLength
    }

    const position = mapSourcePosition({
      name: null,
      source,
      line,
      column,
    })
    state.curPosition = position
    frame = cloneCallSite(frame)
    const originalFunctionName = frame.getFunctionName
    frame.getFunctionName = function () {
      if (state.nextPosition == null) {
        return originalFunctionName()
      }

      return state.nextPosition.name || originalFunctionName()
    }
    frame.getFileName = function () {
      return position.source ?? undefined
    }
    frame.getLineNumber = function () {
      return position.line
    }
    frame.getColumnNumber = function () {
      return position.column + 1
    }
    frame.getScriptNameOrSourceURL = function () {
      return position.source as string
    }
    return frame
  }

  // Code called using eval() needs special handling
  let origin = frame.isEval() && frame.getEvalOrigin()
  if (origin) {
    origin = mapEvalOrigin(origin)
    frame = cloneCallSite(frame)
    frame.getEvalOrigin = function () {
      return origin || undefined
    }
    return frame
  }

  // If we get here then we were unable to change the source position
  return frame
}

// This function is part of the V8 stack trace API, for more info see:
// https://v8.dev/docs/stack-trace-api
function prepareStackTrace(error: Error, stack: CallSite[]) {
  const name = error.name || 'Error'
  const message = error.message || ''
  const errorString = `${name}: ${message}`

  const state = { nextPosition: null, curPosition: null }
  const processedStack = []
  for (let i = stack.length - 1; i >= 0; i--) {
    processedStack.push(`\n    at ${wrapCallSite(stack[i], state)}`)
    state.nextPosition = state.curPosition
  }
  state.curPosition = state.nextPosition = null
  return errorString + processedStack.reverse().join('')
}

const originalRetrieveFileHandlers = retrieveFileHandlers.slice(0)
const originalRetrieveMapHandlers = retrieveMapHandlers.slice(0)

interface Options {
  hookRequire?: boolean
  overrideRetrieveFile?: boolean
  overrideRetrieveSourceMap?: boolean
  retrieveFile?: RetrieveFileHandler
  retrieveSourceMap?: RetrieveMapHandler
}

export const install = function (options: Options) {
  options = options || {}

  // Allow sources to be found by methods other than reading the files
  // directly from disk.
  if (options.retrieveFile) {
    if (options.overrideRetrieveFile) {
      retrieveFileHandlers.length = 0
    }

    retrieveFileHandlers.unshift(options.retrieveFile)
  }

  // Allow source maps to be found by methods other than reading the files
  // directly from disk.
  if (options.retrieveSourceMap) {
    if (options.overrideRetrieveSourceMap) {
      retrieveMapHandlers.length = 0
    }

    retrieveMapHandlers.unshift(options.retrieveSourceMap)
  }

  // Install the error reformatter
  if (!errorFormatterInstalled) {
    errorFormatterInstalled = true
    Error.prepareStackTrace
      = prepareStackTrace as ErrorConstructor['prepareStackTrace']
  }
}

export const resetRetrieveHandlers = function () {
  retrieveFileHandlers.length = 0
  retrieveMapHandlers.length = 0

  retrieveFileHandlers = originalRetrieveFileHandlers.slice(0)
  retrieveMapHandlers = originalRetrieveMapHandlers.slice(0)

  retrieveSourceMap = handlerExec(retrieveMapHandlers)
  retrieveFile = handlerExec(retrieveFileHandlers)
}
