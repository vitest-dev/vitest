import { createHash } from 'node:crypto'
import type { CSSModuleScopeStrategy } from '../../types'

export function generateCssFilenameHash(filepath: string) {
  return createHash('md5').update(filepath).digest('hex').slice(0, 6)
}

export function generateScopedClassName(
  strategy: CSSModuleScopeStrategy,
  name: string,
  filename: string,
) {
  // should be configured by Vite defaults
  if (strategy === 'scoped') {
    return null
  }
  if (strategy === 'non-scoped') {
    return name
  }
  const hash = generateCssFilenameHash(filename)
  return `_${name}_${hash}`
}
