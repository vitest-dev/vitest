import type { Plugin } from 'vite'

const importRegexp = /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s]$/mg
const dynamicImportRegexp = /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s]\)$/mg

const isBareImports = (id: string) => /(\?|&)imports$/.test(id)
const isExternalImport = (id: string) => {
  return (!id.startsWith('/') && !id.startsWith('.')) || id.startsWith('/@fs/')
}

export const ImportsPlugin = (): Plugin => {
  return {
    name: 'vitest:imports',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!isExternalImport(id) || !importer) return

      if (isBareImports(id))
        return this.resolve(id.replace(/(\?|&)imports/, ''), importer, { skipSelf: true })
    },
    async transform(code, id) {
      const imports: string[] = []
      if (!isBareImports(id))
        return

      const addImports = async(pattern: RegExp, index: number) => {
        let match: RegExpExecArray | null
        // eslint-disable-next-line no-cond-assign
        while (match = pattern.exec(code)) {
          const path = await this.resolve(match[index], id)
          if (path && !path.id.includes('node_modules') && path.id.startsWith('/'))
            imports.push(path.id)
        }
      }

      await addImports(importRegexp, 2)
      await addImports(dynamicImportRegexp, 2)

      return imports.map((path) => {
        const delimeter = path.includes('?') ? '&' : '?'
        return `import "${path}${delimeter}imports"`
      }).join('\n')
    },
  }
}
