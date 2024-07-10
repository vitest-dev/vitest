import type { Formatter } from 'tinyrainbow'

export interface MatcherHintOptions {
  comment?: string
  expectedColor?: Formatter
  isDirectExpectCall?: boolean
  isNot?: boolean
  promise?: string
  receivedColor?: Formatter
  secondArgument?: string
  secondArgumentColor?: Formatter
}

export interface DiffOptions {
  aAnnotation?: string
  aColor?: Formatter
  aIndicator?: string
  bAnnotation?: string
  bColor?: Formatter
  bIndicator?: string
  changeColor?: Formatter
  changeLineTrailingSpaceColor?: Formatter
  commonColor?: Formatter
  commonIndicator?: string
  commonLineTrailingSpaceColor?: Formatter
  contextLines?: number
  emptyFirstOrLastLinePlaceholder?: string
  expand?: boolean
  includeChangeCounts?: boolean
  omitAnnotationLines?: boolean
  patchColor?: Formatter
  // pretty-format type
  compareKeys?: any
  truncateThreshold?: number
  truncateAnnotation?: string
  truncateAnnotationColor?: Formatter
}
