import type { Plugin } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'pathe'

interface PathMapping {
  pattern: RegExp
  paths: string[]
}

interface TsConfig {
  extends?: string
  references?: Array<{ path: string }>
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
  }
}

const relativeImportRE = /^\.\.?(?:\/|$)/

export function TsconfigPathsReferencesPlugin(): Plugin {
  let mappings: PathMapping[] = []

  return {
    name: 'vitest:tsconfig-paths-references',
    enforce: 'pre',
    config(config) {
      if (!config.resolve?.tsconfigPaths) {
        mappings = []
        return
      }

      const root = config.root ?? process.cwd()
      const tsconfigPath = join(root, 'tsconfig.json')
      if (!existsSync(tsconfigPath)) {
        mappings = []
        return
      }

      const rootConfig = readTsConfig(tsconfigPath)
      if (!rootConfig?.references?.length && !rootConfig?.extends) {
        mappings = []
        return
      }

      mappings = collectReferencedPathMappings(tsconfigPath)
    },
    async resolveId(source, importer, options) {
      if (!mappings.length || !importer) {
        return null
      }

      if (source.startsWith('\0') || source.includes('\0')) {
        return null
      }

      if (relativeImportRE.test(source)) {
        return null
      }

      if (source.startsWith('/') || source.startsWith('node:')) {
        return null
      }

      for (const mapping of mappings) {
        const match = source.match(mapping.pattern)
        if (!match) {
          continue
        }

        for (const pathTemplate of mapping.paths) {
          const mappedId = applyPathTemplate(pathTemplate, match)
          const resolved = await this.resolve(mappedId, importer, {
            skipSelf: true,
            ...options,
          })
          if (resolved) {
            return resolved
          }
        }
      }

      return null
    },
  }
}

export function collectReferencedPathMappings(tsconfigPath: string): PathMapping[] {
  const config = readTsConfig(tsconfigPath)
  if (!config) {
    return []
  }

  const configDir = dirname(tsconfigPath)
  const mappings: PathMapping[] = []
  const visited = new Set<string>([resolve(tsconfigPath)])

  if (config.references?.length) {
    for (const ref of config.references) {
      const refPath = resolveConfigPath(configDir, ref.path)
      if (existsSync(refPath)) {
        mappings.push(...collectPathMappingsFromConfig(refPath, visited))
      }
    }
  }

  if (config.extends) {
    const extendsPath = resolveConfigPath(configDir, config.extends)
    if (existsSync(extendsPath)) {
      mappings.push(...collectPathMappingsFromConfig(extendsPath, visited))
    }
  }

  return mappings
}

function collectPathMappingsFromConfig(
  configPath: string,
  visited: Set<string>,
): PathMapping[] {
  const normalized = resolve(configPath)
  if (visited.has(normalized)) {
    return []
  }
  visited.add(normalized)

  const config = readTsConfig(normalized)
  if (!config) {
    return []
  }

  const configDir = dirname(normalized)
  const mappings: PathMapping[] = []

  if (config.references?.length) {
    for (const ref of config.references) {
      const refPath = resolveConfigPath(configDir, ref.path)
      if (existsSync(refPath)) {
        mappings.push(...collectPathMappingsFromConfig(refPath, visited))
      }
    }
  }

  if (config.extends) {
    const extendsPath = resolveConfigPath(configDir, config.extends)
    if (existsSync(extendsPath)) {
      mappings.push(...collectPathMappingsFromConfig(extendsPath, visited))
    }
  }

  const paths = config.compilerOptions?.paths
  if (paths) {
    const baseUrl = config.compilerOptions?.baseUrl
    const pathsRoot = baseUrl ? resolve(configDir, baseUrl) : configDir
    mappings.push(...resolvePathMappings(paths, pathsRoot))
  }

  return mappings
}

function resolvePathMappings(
  paths: Record<string, string[]>,
  base: string,
): PathMapping[] {
  const sortedPatterns = Object.keys(paths).sort(
    (a, b) => getPrefixLength(b) - getPrefixLength(a),
  )

  return sortedPatterns.map((pattern) => {
    const relativePaths = paths[pattern]!
    const escaped = escapeStringRegexp(pattern).replace(/\*/g, '(.+)')
    return {
      pattern: new RegExp(`^${escaped}$`),
      paths: relativePaths.map(relativePath => resolve(base, relativePath)),
    }
  })
}

function readTsConfig(path: string): TsConfig | null {
  try {
    const text = readFileSync(path, 'utf-8')
    return JSON.parse(stripJsonComments(text)) as TsConfig
  }
  catch {
    return null
  }
}

function stripJsonComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
}

function resolveConfigPath(baseDir: string, configPath: string): string {
  const resolved = resolve(baseDir, configPath)
  if (resolved.endsWith('.json')) {
    return resolved
  }
  return join(resolved, 'tsconfig.json')
}

function applyPathTemplate(template: string, match: RegExpMatchArray): string {
  let starCount = 0
  return template.replace(/\*/g, () => {
    starCount++
    return match[Math.min(starCount, match.length - 1)] ?? ''
  })
}

function getPrefixLength(pattern: string): number {
  const index = pattern.indexOf('*')
  return index === -1 ? pattern.length : index
}

function escapeStringRegexp(string: string): string {
  return string.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/-/g, '\\x2d')
}
