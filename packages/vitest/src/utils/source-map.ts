import { SourceMapConsumer } from 'source-map-js'
import type { RawSourceMap } from 'source-map-js'
import type { ParsedStack, Position } from '../types/general'
import { notNullish } from './index'

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

const stackFnCallRE = /at (.*) \((.+):(\d+):(\d+)\)$/
const stackBarePathRE = /at ?(.*) (.+):(\d+):(\d+)$/

export function parseStack(stack: string): ParsedStack[] {
  const lines = stack.split('\n')
  const stackFrames = lines.map((raw) => {
    const line = raw.trim()
    const match = line.match(stackFnCallRE) || line.match(stackBarePathRE)
    if (!match)
      return null

    let file = match[2]
    if (file.startsWith('file://'))
      file = file.slice(7)

    return {
      method: match[1],
      file: match[2],
      line: parseInt(match[3]),
      column: parseInt(match[4]),
    }
  })
  return stackFrames.filter(notNullish)
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
  if (typeof offset !== 'number') return offset
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
