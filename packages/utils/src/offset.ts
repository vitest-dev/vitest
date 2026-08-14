export const lineSplitRE: RegExp = /\r?\n/

// a single `\r\n` anywhere used to make every line count as two characters
// wide, so walk the line breaks instead of assuming the file uses one style
function lineEndOffset(source: string, from: number): number {
  const newline = source.indexOf('\n', from)
  return newline === -1 ? source.length : newline + 1
}

export function positionToOffset(
  source: string,
  lineNumber: number,
  columnNumber: number,
): number {
  let start = 0

  for (let line = 1; line < lineNumber; line++) {
    if (start >= source.length) {
      return source.length
    }

    start = lineEndOffset(source, start)
  }

  return start + columnNumber
}

export function offsetToLineNumber(source: string, offset: number): number {
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }

  let line = 1
  let start = 0

  while (start < source.length) {
    const end = lineEndOffset(source, start)
    if (end >= offset) {
      break
    }

    start = end
    line++
  }

  return line
}
