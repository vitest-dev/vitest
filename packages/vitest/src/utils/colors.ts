import type { Colors } from '@vitest/utils'
import { highlight } from '@vitest/utils'
import { extname } from 'pathe'
import c from 'picocolors'

const HIGHLIGHT_SUPPORTED_EXTS = new Set(
  ['js', 'ts'].flatMap(lang => [
    `.${lang}`,
    `.m${lang}`,
    `.c${lang}`,
    `.${lang}x`,
    `.m${lang}x`,
    `.c${lang}x`,
  ]),
)

export function highlightCode(id: string, source: string, colors?: Colors) {
  const ext = extname(id)
  if (!HIGHLIGHT_SUPPORTED_EXTS.has(ext)) {
    return source
  }
  const isJsx = ext.endsWith('x')
  return highlight(source, { jsx: isJsx, colors: colors || c })
}
