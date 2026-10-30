import { Buffer } from 'node:buffer'

let SOURCEMAPPING_URL = 'sourceMa'
SOURCEMAPPING_URL += 'ppingURL'

// the source map is stored after the code in the files that workers read,
// it is JSON without line breaks, so the last marker is always this one
const SOURCE_MAP_SEPARATOR = '\n//# vitestSourceMap='

export function appendSourceMap(content: string, sourceMap: string | undefined): string {
  return `${content}${SOURCE_MAP_SEPARATOR}${sourceMap ?? ''}`
}

export function splitSourceMap(content: string): { code: string; sourceMap: string | undefined } {
  const index = content.lastIndexOf(SOURCE_MAP_SEPARATOR)
  if (index === -1) {
    return { code: content, sourceMap: undefined }
  }
  return {
    code: content.slice(0, index),
    sourceMap: content.slice(index + SOURCE_MAP_SEPARATOR.length) || undefined,
  }
}

// debuggers read the source map from the comment in the compiled script
export function withInlineSourceMap<T extends object>(result: T): T {
  const { code, sourceMap } = result as { code?: string; sourceMap?: string }
  if (code == null || !sourceMap) {
    return result
  }
  return {
    ...result,
    code: `${code}\n//# ${SOURCEMAPPING_URL}=data:application/json;base64,${Buffer.from(sourceMap).toString('base64')}\n`,
  }
}
