import { SourceMapConsumer } from 'source-map-js'
import type { RawSourceMap } from 'vite-node'
import type { ErrorWithDiff, ParsedStack, Position } from '../types'
import type { Vitest } from '../node'
import { notNullish, slash } from './base'

export const lineSplitRE = /\r?\n/

export function getOriginalPos(map: RawSourceMap | null | undefined, { line, column }: Position): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!map)
      return resolve(null)

    const consumer = new SourceMapConsumer(map)
    const pos = consumer.originalPositionFor({ line, column })
    if (pos.line != null && pos.column != null)
      resolve(pos as Position)

    else
      resolve(null)
  })
}

export async function interpretSourcePos(stackFrames: ParsedStack[], ctx: Vitest): Promise<ParsedStack[]> {
  for (const frame of stackFrames) {
    if ('sourcePos' in frame)
      continue
    const transformResult = ctx.server.moduleGraph.getModuleById(frame.file)?.ssrTransformResult
    if (!transformResult)
      continue
    const sourcePos = await getOriginalPos(transformResult.map as any as RawSourceMap | undefined, frame)
    if (sourcePos)
      frame.sourcePos = sourcePos
  }

  return stackFrames
}

const stackIgnorePatterns = [
  'node:internal',
  '/vitest/dist/',
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

export function parseStacktrace(e: ErrorWithDiff, full = false): ParsedStack[] {
  if (e.stacks)
    return e.stacks

  const stackStr = e.stack || e.stackStr || ''
  const stackFrames = stackStr
    .split('\n')
    // Based on https://github.com/stacktracejs/error-stack-parser
    // Credit to stacktracejs
    .map((raw): ParsedStack | null => {
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

      if (!full && stackIgnorePatterns.some(p => file && file.includes(p)))
        return null

      return {
        method,
        file: slash(file),
        line: parseInt(lineNumber),
        column: parseInt(columnNumber),
      }
    })
    .filter(notNullish)

  e.stacks = stackFrames
  return stackFrames
}

export function posToNumber(
  source: string,
  pos: number | Position,
): number {
  if (typeof pos === 'number')
    return pos
  const lines = source.split(lineSplitRE)
  const { line, column } = pos
  let start = 0

  if (line > lines.length)
    return source.length

  for (let i = 0; i < line - 1; i++)
    start += lines[i].length + 1

  return start + column
}

export function numberToPos(
  source: string,
  offset: number | Position,
): Position {
  if (typeof offset !== 'number')
    return offset
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(lineSplitRE)
  let counted = 0
  let line = 0
  let column = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset) {
      column = offset - counted + 1
      break
    }
    counted += lineLength
  }
  return { line: line + 1, column }
}
