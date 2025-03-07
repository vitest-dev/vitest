// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'

export function createDtsUtils({
  isolatedDeclDir = '.types',
  cleanupDir = '.types',
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
        }),
        {
          name: 'isolated-decl-dts-extra',
          resolveId(source) {
            // silence node-resolve error by isolated-decl transform of type import
            if (source.startsWith('vite/types/')) {
              return { id: '/node_modules/', external: true }
            }
          },
        },
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
          buildEnd() {
            // keep temporary type files on watch mode since removing them makes re-build flaky
            if (!this.meta.watchMode) {
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
