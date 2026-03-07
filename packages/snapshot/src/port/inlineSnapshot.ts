import type MagicString from 'magic-string'
import type { SnapshotEnvironment } from '../types'
import { getCallLastIndex } from '@vitest/utils/helpers'
import {
  lineSplitRE,
  offsetToLineNumber,
  positionToOffset,
} from '@vitest/utils/offset'

export interface InlineSnapshot {
  snapshot: string
  testId: string
  file: string
  line: number
  column: number
}

export async function saveInlineSnapshots(
  environment: SnapshotEnvironment,
  snapshots: Array<InlineSnapshot>,
): Promise<void> {
  const MagicString = (await import('magic-string')).default
  const files = new Set(snapshots.map(i => i.file))
  await Promise.all(
    Array.from(files).map(async (file) => {
      const snaps = snapshots.filter(i => i.file === file)
      const code = await environment.readSnapshotFile(file)
      if (code == null) {
        throw new Error(`cannot read ${file} when saving inline snapshot`)
      }

      const s = new MagicString(code)

      for (const snap of snaps) {
        const index = positionToOffset(code, snap.line, snap.column)
        replaceInlineSnap(code, s, index, snap.snapshot)
      }

      const transformed = s.toString()
      if (transformed !== code) {
        await environment.saveSnapshotFile(file, transformed)
      }
    }),
  )
}

const startObjectRegex
  = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*(?:\/\*[\s\S]*\*\/\s*|\/\/.*(?:[\n\r\u2028\u2029]\s*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]))*\{/

function replaceObjectSnap(
  code: string,
  s: MagicString,
  index: number,
  newSnap: string,
) {
  let _code = code.slice(index)
  const startMatch = startObjectRegex.exec(_code)
  if (!startMatch) {
    return false
  }

  _code = _code.slice(startMatch.index)

  let callEnd = getCallLastIndex(_code)
  if (callEnd === null) {
    return false
  }
  callEnd += index + startMatch.index

  const shapeStart = index + startMatch.index + startMatch[0].length
  const shapeEnd = getObjectShapeEndIndex(code, shapeStart)
  const snap = `, ${prepareSnapString(newSnap, code, index)}`

  if (shapeEnd === callEnd) {
    // toMatchInlineSnapshot({ foo: expect.any(String) })
    s.appendLeft(callEnd, snap)
  }
  else {
    // toMatchInlineSnapshot({ foo: expect.any(String) }, ``)
    s.overwrite(shapeEnd, callEnd, snap)
  }

  return true
}

function getObjectShapeEndIndex(code: string, index: number) {
  let startBraces = 1
  let endBraces = 0
  while (startBraces !== endBraces && index < code.length) {
    const s = code[index++]
    if (s === '{') {
      startBraces++
    }
    else if (s === '}') {
      endBraces++
    }
  }
  return index
}

function prepareSnapString(snap: string, source: string, index: number) {
  const lineNumber = offsetToLineNumber(source, index)
  const line = source.split(lineSplitRE)[lineNumber - 1]
  const indent = line.match(/^\s*/)![0] || ''
  const indentNext = indent.includes('\t') ? `${indent}\t` : `${indent}  `

  const lines = snap.trim().replace(/\\/g, '\\\\').split(/\n/g)

  const isOneline = lines.length <= 1
  const quote = '`'
  if (isOneline) {
    return `${quote}${lines
      .join('\n')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${')}${quote}`
  }
  return `${quote}\n${lines
    .map(i => (i ? indentNext + i : ''))
    .join('\n')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')}\n${indent}${quote}`
}

const toMatchInlineName = 'toMatchInlineSnapshot'
const toMatchDomainInlineName = 'toMatchDomainInlineSnapshot'
const toThrowErrorMatchingInlineName = 'toThrowErrorMatchingInlineSnapshot'

// on webkit, the line number is at the end of the method, not at the start
function getCodeStartingAtIndex(code: string, index: number) {
  for (const name of [
    toMatchDomainInlineName,
    toMatchInlineName,
    toThrowErrorMatchingInlineName,
  ]) {
    const methodIndex = index - name.length
    if (methodIndex >= 0 && code.slice(methodIndex, index) === name) {
      return {
        code: code.slice(methodIndex),
        index: methodIndex,
      }
    }
  }

  return {
    code: code.slice(index),
    index,
  }
}

function findTopLevelComma(code: string, start: number, end: number): number {
  let parenDepth = 0
  let braceDepth = 0
  let bracketDepth = 0
  let inString: '"' | '\'' | '`' | null = null
  let isEscaped = false

  for (let i = start; i < end; i++) {
    const ch = code[i]
    const next = code[i + 1]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
        continue
      }
      if (ch === '\\') {
        isEscaped = true
        continue
      }
      if (ch === inString) {
        inString = null
      }
      continue
    }

    if (ch === '/' && next === '/') {
      i += 2
      while (i < end && !/[\n\r\u2028\u2029]/.test(code[i])) {
        i++
      }
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < end && !(code[i] === '*' && code[i + 1] === '/')) {
        i++
      }
      i++
      continue
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch
      continue
    }

    if (ch === '(') {
      parenDepth++
      continue
    }
    if (ch === ')') {
      parenDepth--
      continue
    }
    if (ch === '{') {
      braceDepth++
      continue
    }
    if (ch === '}') {
      braceDepth--
      continue
    }
    if (ch === '[') {
      bracketDepth++
      continue
    }
    if (ch === ']') {
      bracketDepth--
      continue
    }

    if (ch === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      return i
    }
  }

  return -1
}

function skipWhitespaceAndComments(code: string, start: number, end: number): number {
  let index = start
  while (index < end) {
    const ch = code[index]
    const next = code[index + 1]

    if (/\s/.test(ch)) {
      index++
      continue
    }

    if (ch === '/' && next === '/') {
      index += 2
      while (index < end && !/[\n\r\u2028\u2029]/.test(code[index])) {
        index++
      }
      continue
    }

    if (ch === '/' && next === '*') {
      index += 2
      while (index < end && !(code[index] === '*' && code[index + 1] === '/')) {
        index++
      }
      index += 2
      continue
    }

    break
  }

  return index
}

function replaceDomainInlineSnap(
  code: string,
  s: MagicString,
  index: number,
  newSnap: string,
): boolean {
  const codeStartingAtIndex = code.slice(index)
  const startMatch = /toMatchDomainInlineSnapshot\s*\(/.exec(codeStartingAtIndex)
  const firstKeywordMatch = /toMatchDomainInlineSnapshot/.exec(codeStartingAtIndex)

  if (!startMatch || startMatch.index !== firstKeywordMatch?.index) {
    return false
  }

  const callStart = index + startMatch.index
  const callEndInSlice = getCallLastIndex(code.slice(callStart))
  if (callEndInSlice == null) {
    return false
  }

  const callEnd = callStart + callEndInSlice
  const argsStart = callStart + startMatch[0].length
  const firstArgComma = findTopLevelComma(code, argsStart, callEnd)
  if (firstArgComma === -1) {
    return false
  }

  const secondArgStart = skipWhitespaceAndComments(code, firstArgComma + 1, callEnd)
  const snapString = prepareSnapString(newSnap, code, index)

  if (secondArgStart >= callEnd) {
    s.appendLeft(callEnd, `, ${snapString}`)
    return true
  }

  const secondArgComma = findTopLevelComma(code, secondArgStart, callEnd)
  const secondArgEnd = secondArgComma === -1 ? callEnd : secondArgComma
  s.overwrite(secondArgStart, secondArgEnd, snapString)
  return true
}

const startRegex
  = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*(?:\/\*[\s\S]*\*\/\s*|\/\/.*(?:[\n\r\u2028\u2029]\s*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]))*[\w$]*(['"`)])/
export function replaceInlineSnap(
  code: string,
  s: MagicString,
  currentIndex: number,
  newSnap: string,
): boolean {
  const { code: codeStartingAtIndex, index } = getCodeStartingAtIndex(code, currentIndex)

  if (replaceDomainInlineSnap(code, s, index, newSnap)) {
    return true
  }

  const startMatch = startRegex.exec(codeStartingAtIndex)

  const firstKeywordMatch = /toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot/.exec(
    codeStartingAtIndex,
  )

  if (!startMatch || startMatch.index !== firstKeywordMatch?.index) {
    return replaceObjectSnap(code, s, index, newSnap)
  }

  const quote = startMatch[1]
  const startIndex = index + startMatch.index + startMatch[0].length
  const snapString = prepareSnapString(newSnap, code, index)

  if (quote === ')') {
    s.appendRight(startIndex - 1, snapString)
    return true
  }

  const quoteEndRE = new RegExp(`(?:^|[^\\\\])${quote}`)
  const endMatch = quoteEndRE.exec(code.slice(startIndex))
  if (!endMatch) {
    return false
  }
  const endIndex = startIndex + endMatch.index! + endMatch[0].length
  s.overwrite(startIndex - 1, endIndex, snapString)

  return true
}

const INDENTATION_REGEX = /^([^\S\n]*)\S/m
export function stripSnapshotIndentation(inlineSnapshot: string): string {
  // Find indentation if exists.
  const match = inlineSnapshot.match(INDENTATION_REGEX)
  if (!match || !match[1]) {
    // No indentation.
    return inlineSnapshot
  }

  const indentation = match[1]
  const lines = inlineSnapshot.split(/\n/g)
  if (lines.length <= 2) {
    // Must be at least 3 lines.
    return inlineSnapshot
  }

  if (lines[0].trim() !== '' || lines.at(-1)?.trim() !== '') {
    // If not blank first and last lines, abort.
    return inlineSnapshot
  }

  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i] !== '') {
      if (lines[i].indexOf(indentation) !== 0) {
        // All lines except first and last should either be blank or have the same
        // indent as the first line (or more). If this isn't the case we don't
        // want to touch the snapshot at all.
        return inlineSnapshot
      }

      lines[i] = lines[i].substring(indentation.length)
    }
  }

  // Last line is a special case because it won't have the same indent as others
  // but may still have been given some indent to line up.
  lines[lines.length - 1] = ''

  // Return inline snapshot, now at indent 0.
  inlineSnapshot = lines.join('\n')
  return inlineSnapshot
}
