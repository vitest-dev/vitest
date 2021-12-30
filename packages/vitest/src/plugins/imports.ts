import { readFile } from 'fs/promises'
import type { Plugin } from 'vite'

const importRegexp = /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s]$/mg
const dynamicImportRegexp = /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s]\)$/mg

const isBareImports = (id: string) => /(\?|&)imports$/.test(id)
const isExternalImport = (id: string) => {
  return (!id.startsWith('/') && !id.startsWith('.')) || id.startsWith('/@fs/') || id.includes('node_modules')
}

/**
 * Keeps only imports inside a file to analize dependency graph
 * without actually calling real code and/or creating side effects
 */
export const ImportsPlugin = (): Plugin => {
  const files: Record<string, string> = {}
  return {
    name: 'vitest:imports',
    enforce: 'pre',
    async transform(code, id) {
      if (!isBareImports(id))
        return
      const imports: string[] = []
      const deps = new Set()

      const addImports = async(code: string, filepath: string, pattern: RegExp) => {
        let match: RegExpExecArray | null
        // eslint-disable-next-line no-cond-assign
        while (match = pattern.exec(code)) {
          const path = await this.resolve(match[2], filepath)
          if (path && !isExternalImport(path.id) && !deps.has(path.id)) {
            imports.push(path.id)

            const depCode = files[path.id] || (files[path.id] = await readFile(path.id, 'utf-8'))

            await addImports(depCode, path.id, importRegexp)
            await addImports(depCode, path.id, dynamicImportRegexp)

            deps.add(path.id)
          }
        }
      }

      await addImports(code, id, importRegexp)
      await addImports(code, id, dynamicImportRegexp)

      return imports.map(path => `import "${path}"`).join('\n')
    },
  }
}
