import { promises as fs } from 'fs'
import type MagicString from 'magic-string'
import { lineSplitRE, numberToPos, posToNumber } from '../../../utils/source-map'
import { getCallLastIndex } from '../../../utils'

export interface InlineSnapshot {
  snapshot: string
  file: string
  line: number
  column: number
}

export async function saveInlineSnapshots(
  snapshots: Array<InlineSnapshot>,
) {
  const MagicString = (await import('magic-string')).default
  const files = new Set(snapshots.map(i => i.file))
  await Promise.all(Array.from(files).map(async (file) => {
    const snaps = snapshots.filter(i => i.file === file)
    const code = await fs.readFile(file, 'utf8')
    const s = new MagicString(code)

    for (const snap of snaps) {
      const index = posToNumber(code, snap)
      replaceInlineSnap(code, s, index, snap.snapshot)
    }

    const transformed = s.toString()
    if (transformed !== code)
      await fs.writeFile(file, transformed, 'utf-8')
  }))
}

const startObjectRegex = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*(?:\/\*[\S\s]*\*\/\s*|\/\/.*\s+)*\s*({)/m

function replaceObjectSnap(code: string, s: MagicString, index: number, newSnap: string) {
  code = code.slice(index)
  const startMatch = startObjectRegex.exec(code)
  if (!startMatch)
    return false

  code = code.slice(startMatch.index)
  const charIndex = getCallLastIndex(code)
  if (charIndex === null)
    return false

  s.appendLeft(index + startMatch.index + charIndex, `, ${prepareSnapString(newSnap, code, index)}`)

  return true
}

function prepareSnapString(snap: string, source: string, index: number) {
  const lineIndex = numberToPos(source, index).line
  const line = source.split(lineSplitRE)[lineIndex - 1]
  const indent = line.match(/^\s*/)![0] || ''
  const indentNext = indent.includes('\t') ? `${indent}\t` : `${indent}  `

  const lines = snap
    .trim()
    .replace(/\\/g, '\\\\')
    .split(/\n/g)

  const isOneline = lines.length <= 1
  const quote = isOneline ? '\'' : '`'
  if (isOneline)
    return `'${lines.join('\n').replace(/'/g, '\\\'')}'`
  else
    return `${quote}\n${lines.map(i => i ? indentNext + i : '').join('\n').replace(/`/g, '\\`').replace(/\${/g, '\\${')}\n${indent}${quote}`
}

const startRegex = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*(?:\/\*[\S\s]*\*\/\s*|\/\/.*\s+)*\s*[\w_$]*(['"`\)])/m
export function replaceInlineSnap(code: string, s: MagicString, index: number, newSnap: string) {
  const startMatch = startRegex.exec(code.slice(index))
  if (!startMatch)
    return replaceObjectSnap(code, s, index, newSnap)

  const quote = startMatch[1]
  const startIndex = index + startMatch.index! + startMatch[0].length
  const snapString = prepareSnapString(newSnap, code, index)

  if (quote === ')') {
    s.appendRight(startIndex - 1, snapString)
    return true
  }

  const quoteEndRE = new RegExp(`(?:^|[^\\\\])${quote}`)
  const endMatch = quoteEndRE.exec(code.slice(startIndex))
  if (!endMatch)
    return false
  const endIndex = startIndex + endMatch.index! + endMatch[0].length
  s.overwrite(startIndex - 1, endIndex, snapString)

  return true
}

const INDENTATION_REGEX = /^([^\S\n]*)\S/m
export function stripSnapshotIndentation(inlineSnapshot: string) {
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

  if (lines[0].trim() !== '' || lines[lines.length - 1].trim() !== '') {
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
