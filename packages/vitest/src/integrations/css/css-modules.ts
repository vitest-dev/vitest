import type { CSSModuleScopeStrategy } from '../../node/types/config'
import { hash } from '../../node/hash'

export function generateCssFilenameHash(filepath: string): string {
  return hash('sha1', filepath, 'hex').slice(0, 6)
}

export function generateScopedClassName(
  strategy: CSSModuleScopeStrategy,
  name: string,
  filename: string,
): string | null {
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
