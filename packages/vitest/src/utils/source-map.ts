import { resolve } from 'pathe'
import type { ErrorWithDiff, ParsedStack } from '../types'
import { notNullish } from './base'

export const lineSplitRE = /\r?\n/

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
]

function extractLocation(urlLike: string) {
  // Fail-fast but return locations like "(native)"
  if (!urlLike.includes(':'))
    return [urlLike]

  const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
  const parts = regExp.exec(urlLike.replace(/[()]/g, ''))
  if (!parts)
    return [urlLike]
  return [parts[1], parts[2] || undefined, parts[3] || undefined]
}

// Based on https://github.com/stacktracejs/error-stack-parser
// Credit to stacktracejs
export function parseSingleStack(raw: string): ParsedStack | null {
  let line = raw.trim()

  if (line.includes('(eval '))
    line = line.replace(/eval code/g, 'eval').replace(/(\(eval at [^()]*)|(,.*$)/g, '')

  let sanitizedLine = line
    .replace(/^\s+/, '')
    .replace(/\(eval code/g, '(')
    .replace(/^.*?\s+/, '')

  // capture and preserve the parenthesized location "(/foo/my bar.js:12:87)" in
  // case it has spaces in it, as the string is split on \s+ later on
  const location = sanitizedLine.match(/ (\(.+\)$)/)

  // remove the parenthesized location from the line, if it was matched
  sanitizedLine = location ? sanitizedLine.replace(location[0], '') : sanitizedLine

  // if a location was matched, pass it to extractLocation() otherwise pass all sanitizedLine
  // because this line doesn't have function name
  const [url, lineNumber, columnNumber] = extractLocation(location ? location[1] : sanitizedLine)
  let method = (location && sanitizedLine) || ''
  let file = url && ['eval', '<anonymous>'].includes(url) ? undefined : url

  if (!file || !lineNumber || !columnNumber)
    return null

  if (method.startsWith('async '))
    method = method.slice(6)

  if (file.startsWith('file://'))
    file = file.slice(7)

  // normalize Windows path (\ -> /)
  file = resolve(file)

  return {
    method,
    file,
    line: parseInt(lineNumber),
    column: parseInt(columnNumber),
  }
}

export function parseStacktrace(stack: string, full = false): ParsedStack[] {
  const stackFrames = stack
    .split('\n')
    .map((raw): ParsedStack | null => {
      const stack = parseSingleStack(raw)

      if (!stack || (!full && stackIgnorePatterns.some(p => stack.file.match(p))))
        return null

      return stack
    })
    .filter(notNullish)

  return stackFrames
}

export function parseErrorStacktrace(e: ErrorWithDiff, full = false): ParsedStack[] {
  if (!e)
    return []

  if (e.stacks)
    return e.stacks

  const stackStr = e.stack || e.stackStr || ''
  const stackFrames = parseStacktrace(stackStr, full)

  e.stacks = stackFrames
  return stackFrames
}

export function positionToOffset(
  source: string,
  lineNumber: number,
  columnNumber: number,
): number {
  const lines = source.split(lineSplitRE)
  let start = 0

  if (lineNumber > lines.length)
    return source.length

  for (let i = 0; i < lineNumber - 1; i++)
    start += lines[i].length + 1

  return start + columnNumber
}

export function offsetToLineNumber(
  source: string,
  offset: number,
): number {
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(lineSplitRE)
  let counted = 0
  let line = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset)
      break

    counted += lineLength
  }
  return line + 1
}
