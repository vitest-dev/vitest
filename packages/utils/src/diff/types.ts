/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { CompareKeys } from '@vitest/pretty-format'

export type DiffOptionsColor = (arg: string) => string

export interface DiffOptions {
  aAnnotation?: string
  aColor?: DiffOptionsColor
  aIndicator?: string
  bAnnotation?: string
  bColor?: DiffOptionsColor
  bIndicator?: string
  changeColor?: DiffOptionsColor
  changeLineTrailingSpaceColor?: DiffOptionsColor
  commonColor?: DiffOptionsColor
  commonIndicator?: string
  commonLineTrailingSpaceColor?: DiffOptionsColor
  contextLines?: number
  emptyFirstOrLastLinePlaceholder?: string
  expand?: boolean
  includeChangeCounts?: boolean
  omitAnnotationLines?: boolean
  patchColor?: DiffOptionsColor
  printBasicPrototype?: boolean
  compareKeys?: CompareKeys
  truncateThreshold?: number
  truncateAnnotation?: string
  truncateAnnotationColor?: DiffOptionsColor
}

export interface DiffOptionsNormalized {
  aAnnotation: string
  aColor: DiffOptionsColor
  aIndicator: string
  bAnnotation: string
  bColor: DiffOptionsColor
  bIndicator: string
  changeColor: DiffOptionsColor
  changeLineTrailingSpaceColor: DiffOptionsColor
  commonColor: DiffOptionsColor
  commonIndicator: string
  commonLineTrailingSpaceColor: DiffOptionsColor
  compareKeys: CompareKeys
  contextLines: number
  emptyFirstOrLastLinePlaceholder: string
  expand: boolean
  includeChangeCounts: boolean
  omitAnnotationLines: boolean
  patchColor: DiffOptionsColor
  printBasicPrototype: boolean
  truncateThreshold: number
  truncateAnnotation: string
  truncateAnnotationColor: DiffOptionsColor
}
