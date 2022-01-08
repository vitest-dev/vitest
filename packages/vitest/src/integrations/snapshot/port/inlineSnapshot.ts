import { promises as fs } from 'fs'
import type MagicString from 'magic-string'
import { rpc } from '../../../runtime/rpc'
import { getOriginalPos, posToNumber } from '../../../utils/source-map'

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
  await Promise.all(Array.from(files).map(async(file) => {
    const map = await rpc().getSourceMap(file)
    const snaps = snapshots.filter(i => i.file === file)
    const code = await fs.readFile(file, 'utf8')
    const s = new MagicString(code)

    for (const snap of snaps) {
      const pos = await getOriginalPos(map, snap)
      const index = posToNumber(code, pos!)
      replaceInlineSnap(code, s, index, snap.snapshot) // TODO: support indent: ' '.repeat(4))
    }

    const transformed = s.toString()
    if (transformed !== code)
      await fs.writeFile(file, transformed, 'utf-8')
  }))
}

const startObjectRegex = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*({)/m

function getEndIndex(code: string) {
  let charIndex = -1
  let inString: string | null = null //
  let startedBracers = 0
  let endedBracers = 0
  let beforeChar: string | null = null
  while (charIndex <= code.length) {
    beforeChar = code[charIndex]
    charIndex++
    const char = code[charIndex]

    const isCharString = char === '"' || char === '\'' || char === '`'

    if (isCharString && beforeChar !== '\\')
      inString = inString === char ? null : char

    if (!inString) {
      if (char === '(')
        startedBracers++
      if (char === ')')
        endedBracers++
    }

    if (startedBracers && endedBracers && startedBracers === endedBracers)
      return charIndex
  }
  return null
}

function replaceObjectSnap(code: string, s: MagicString, index: number, newSnap: string, indent = '') {
  code = code.slice(index)
  const startMatch = startObjectRegex.exec(code)
  if (!startMatch)
    return false

  code = code.slice(startMatch.index)
  const charIndex = getEndIndex(code)
  if (charIndex === null)
    return false

  s.appendLeft(index + startMatch.index + charIndex, `, ${prepareSnapString(newSnap, indent)}`)

  return true
}

function prepareSnapString(snap: string, indent: string) {
  snap = snap.replace(/\\/g, '\\\\')
    .split('\n')
    .map(i => (indent + i).trimEnd())
    .join('\n')
  const isOneline = !snap.includes('\n')
  return isOneline
    ? `'${snap.replace(/'/g, '\\\'').trim()}'`
    : `\`${snap.replace(/`/g, '\\`').trimEnd()}\``
}

const startRegex = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\(\s*(['"`\)])/m
export function replaceInlineSnap(code: string, s: MagicString, index: number, newSnap: string, indent = '') {
  const startMatch = startRegex.exec(code.slice(index))
  if (!startMatch)
    return replaceObjectSnap(code, s, index, newSnap, indent)

  const snapString = prepareSnapString(newSnap, indent)

  const quote = startMatch[1]

  const startIndex = index + startMatch.index! + startMatch[0].length

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
