import type { CSSModuleScopeStrategy } from '../../types'

export function generateCssFilenameHash(filename: string) {
  return Buffer.from(filename).toString('base64').substring(0, 6)
}

export function generateScopedClassName(
  strategy: CSSModuleScopeStrategy,
  name: string,
  filename: string,
) {
  // should be configured by Vite defaults
  if (strategy === 'scoped')
    return null
  if (strategy === 'non-scoped')
    return name
  const hash = generateCssFilenameHash(filename)
  return `_${name}_${hash}`
}
