import { readFileSync } from 'node:fs'
import path from 'node:path'
import convertSourceMap from 'convert-source-map'

export interface ExtractedSourceMap {
  code: string
  map: any
}

export function extractSourcemapFromFile(
  code: string,
  filePath: string,
): ExtractedSourceMap | undefined {
  const map = (
    convertSourceMap.fromSource(code)
    || convertSourceMap.fromMapFileSource(
      code,
      createConvertSourceMapReadMap(filePath),
    )
  )?.toObject()

  if (map) {
    return {
      code: code.replace(convertSourceMap.mapFileCommentRegex, ''),
      map,
    }
  }
}

function createConvertSourceMapReadMap(originalFileName: string) {
  return (filename: string) => {
    return readFileSync(path.resolve(path.dirname(originalFileName), filename), 'utf-8')
  }
}
