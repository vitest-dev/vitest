export const lineSplitRE: RegExp = /\r?\n/

export function positionToOffset(
  source: string,
  lineNumber: number,
  columnNumber: number,
): number {
  const lines = source.split(lineSplitRE)
  const nl = /\r\n/.test(source) ? 2 : 1
  let start = 0

  if (lineNumber > lines.length) {
    return source.length
  }

  for (let i = 0; i < lineNumber - 1; i++) {
    start += lines[i].length + nl
  }

  return start + columnNumber
}

export function offsetToLineNumber(source: string, offset: number): number {
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(lineSplitRE)
  const nl = /\r\n/.test(source) ? 2 : 1
  let counted = 0
  let line = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + nl
    if (counted + lineLength >= offset) {
      break
    }

    counted += lineLength
  }
  return line + 1
}

export function offsetToPosition(
  source: string,
  offset: number,
): { line: number; column: number } {
  const lineLengths = source
    .split(/(?<=\n)|(?<=\r\n)/)
    .map(line => line.length)
  let acc = 0
  for (let i = 0; i < lineLengths.length; i++) {
    if (offset <= acc + lineLengths[i]) {
      return {
        line: i + 1,
        column: offset - acc,
      }
    }
    acc += lineLengths[i]
  }
  throw new Error(
    `offset is longer than source length! offset ${offset} > length ${source.length}`,
  )
}
