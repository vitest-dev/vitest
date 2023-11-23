import { stripLiteral } from 'strip-literal'
import type { Plugin } from 'vite'

const metaUrlLength = 'import.meta.url'.length
const locationString = 'self.location'.padEnd(metaUrlLength, ' ')

// Vite transforms new URL('./path', import.meta.url) to new URL('/path.js', import.meta.url)
// This makes "href" equal to "http://localhost:3000/path.js" in the browser, but if we keep it like this,
// then in tests the URL will become "file:///path.js".
// To battle this, we replace "import.meta.url" with "self.location" in the code to keep the browser behavior.
export function NormalizeURLPlugin(): Plugin {
  return {
    name: 'vitest:normalize-url',
    enforce: 'post',
    transform(code, id, options) {
      const ssr = options?.ssr === true
      if (ssr || !code.includes('new URL') || !code.includes('import.meta.url'))
        return

      const cleanString = stripLiteral(code)
      const assetImportMetaUrlRE
      = /\bnew\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*(?:,\s*)?\)/g

      let updatedCode = code
      let match: RegExpExecArray | null
      // eslint-disable-next-line no-cond-assign
      while ((match = assetImportMetaUrlRE.exec(cleanString))) {
        const { 0: exp, index } = match
        const metaUrlIndex = index + exp.indexOf('import.meta.url')
        updatedCode = updatedCode.slice(0, metaUrlIndex) + locationString + updatedCode.slice(metaUrlIndex + metaUrlLength)
      }

      return {
        code: updatedCode,
        map: null,
      }
    },
  }
}
