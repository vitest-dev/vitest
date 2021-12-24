import { promises as fs } from 'fs'
import type MagicString from 'magic-string'
import { rpc } from '../../../runtime/rpc'
import { getOriginalPos, posToNumber } from '../../../utils/source-map'

export type InlineSnapshot = {
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
  for (const file of files) {
    const map = await rpc('getSourceMap', file)
    const snaps = snapshots.filter(i => i.file === file)
    const code = await fs.readFile(file, 'utf8')
    const s = new MagicString(code)

    for (const snap of snaps) {
      const pos = await getOriginalPos(map, snap)
      const index = posToNumber(code, pos!)
      updateInlineSnap(code, s, index, snap.snapshot)
    }

    await fs.writeFile(file, s.toString(), 'utf-8')
  }
}

const startRegex = /toMatchInlineSnapshot\s*\(\s*(['"`])/m
export function updateInlineSnap(code: string, s: MagicString, index: number, newSnap: string) {
  const startMatch = startRegex.exec(code.slice(index))
  if (!startMatch)
    return false
  const quoteStart = index + startMatch.index! + startMatch[0].length
  const quote = startMatch[1]
  const quoteEndRE = new RegExp(`(?!\\\\)${quote}`)
  const endMatch = quoteEndRE.exec(code.slice(quoteStart))
  if (!endMatch)
    return false
  const endIndex = quoteStart + endMatch.index!
  const snapString = newSnap.includes('\n')
    ? `\`${newSnap.replace('`', '\\`').trimEnd()}\``
    : `'${newSnap.replace('\'', '\\\'')}'`
  s.overwrite(quoteStart - 1, endIndex + 1, snapString)
  return true
}
