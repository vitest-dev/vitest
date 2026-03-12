// @ts-check
import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'

/**
 * Node.js builtin modules for rollup config.
 * Unprefixed and "node:"-prefixed names are both included for compatibility with different import styles in source code.
 * @type {string[]}
 */
export const nodejsBuiltinModules = builtinModules.flatMap(m => m.includes(':') ? m : [m, `node:${m}`])
/**
 * External dependencies for rollup config, which are union of dependencies, optionalDependencies, and peerDependencies from package.json.
 * @param {string} importMetaUrl
 * @param {{ selfImportList?: string[] }} options
 * @returns {(RegExp|string)[]} external dependencies for rollup config
 */
export function externalDependencies(importMetaUrl, { selfImportList = [] } = {}) {
  const _require = createRequire(importMetaUrl)
  const pkg = _require('./package.json')
  const wrongSelfImports = selfImportList.filter(p => !(`${p}/`).startsWith(`${pkg.name}/`))
  if (wrongSelfImports.length) {
    throw new Error(`Invalid self-imports: ${wrongSelfImports.join(', ')}. They should start with "${pkg.name}/"`)
  }
  return [
    ...Object.keys(({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })).map(key => new RegExp(`^${key}($|/)`)),
    ...selfImportList,
  ]
}

/**
 * @param {{ isolatedDeclDir?: string; cleanupDir?: string; inputBase?: string }} options
 */
export function createDtsUtils({
  isolatedDeclDir = '.types',
  cleanupDir = '.types',
  inputBase,
} = {}) {
  return {
    /**
     * @returns {import('rollup').Plugin[]} plugins
     */
    isolatedDecl() {
      return [
        isolatedDecl({
          transformer: 'oxc',
          transformOptions: { stripInternal: true },
          // exclude direct imports to other package sources
          include: path.join(process.cwd(), '**/*.ts'),
          extraOutdir: isolatedDeclDir,
          inputBase,
        }),
      ]
    },
    /**
     * @returns {import('rollup').Plugin[]} plugins
     */
    dts() {
      return [
        dts({ respectExternal: true }),
        {
          name: 'isolated-decl-dts-extra',
          buildEnd(error) {
            // keep temporary type files on watch mode since removing them makes re-build flaky
            if (!error && !this.meta.watchMode) {
              fs.rmSync(`dist/${cleanupDir}`, { recursive: true, force: true })
            }
          },
        },
      ]
    },
    /**
     * @param {Record<string, string> | string} input
     */
    dtsInput(input, { ext = 'ts' } = {}) {
      if (typeof input === 'string') {
        input = { index: '' }
      }
      return Object.fromEntries(
        Object.keys(input).map(name => [
          name,
          `dist/${isolatedDeclDir}/${name}.d.${ext}`,
        ]),
      )
    },
  }
}
