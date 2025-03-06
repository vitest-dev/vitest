// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'

export function createDtsUtils() {
  return {
    isolatedDecl() {
      return isolatedDecl({
        transformer: 'oxc',
        transformOptions: { stripInternal: true },
        // exclude direct imports to other package sources
        include: path.join(process.cwd(), '**/*.ts'),
        extraOutdir: '.types',
      })
    },
    /**
     * @returns {import('rollup').Plugin} dts
     */
    dts() {
      return {
        ...dts({ respectExternal: true }),
        buildEnd() {
          // keep temporary type files on watch mode since removing them makes re-build flaky
          if (!this.meta.watchMode) {
            fs.rmSync('dist/.types', { recursive: true, force: true })
          }
        },
      }
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
          `dist/.types/${name}.d.${ext}`,
        ]),
      )
    },
  }
}
