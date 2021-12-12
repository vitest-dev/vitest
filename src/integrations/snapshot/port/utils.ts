/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import fs from 'fs'
import naturalCompare from 'natural-compare'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import {
  format as prettyFormat,
} from 'pretty-format'
import type { SnapshotData, SnapshotUpdateState } from '../../../types'
import { getSerializers } from './plugins'

// TODO: rewrite and clean up

export const SNAPSHOT_VERSION = '1'

const writeSnapshotVersion = () => `// Vitest Snapshot v${SNAPSHOT_VERSION}`

export const testNameToKey = (testName: string, count: number): string =>
  `${testName} ${count}`

export const keyToTestName = (key: string): string => {
  if (!/ \d+$/.test(key))
    throw new Error('Snapshot keys must end with a number.')

  return key.replace(/ \d+$/, '')
}

export const getSnapshotData = (
  snapshotPath: string,
  update: SnapshotUpdateState,
): {
  data: SnapshotData
  dirty: boolean
} => {
  const data = Object.create(null)
  let snapshotContents = ''
  let dirty = false

  if (fs.existsSync(snapshotPath)) {
    try {
      snapshotContents = fs.readFileSync(snapshotPath, 'utf8')
      // eslint-disable-next-line no-new-func
      const populate = new Function('exports', snapshotContents)
      populate(data)
    }
    catch {}
  }

  // const validationResult = validateSnapshotVersion(snapshotContents)
  const isInvalid = snapshotContents // && validationResult

  // if (update === 'none' && isInvalid)
  //   throw validationResult

  if ((update === 'all' || update === 'new') && isInvalid)
    dirty = true

  return { data, dirty }
}

// Add extra line breaks at beginning and end of multiline snapshot
// to make the content easier to read.
export const addExtraLineBreaks = (string: string): string =>
  string.includes('\n') ? `\n${string}\n` : string

// Remove extra line breaks at beginning and end of multiline snapshot.
// Instead of trim, which can remove additional newlines or spaces
// at beginning or end of the content from a custom serializer.
export const removeExtraLineBreaks = (string: string): string =>
  string.length > 2 && string.startsWith('\n') && string.endsWith('\n')
    ? string.slice(1, -1)
    : string

// export const removeLinesBeforeExternalMatcherTrap = (stack: string): string => {
//   const lines = stack.split('\n')

//   for (let i = 0; i < lines.length; i += 1) {
//     // It's a function name specified in `packages/expect/src/index.ts`
//     // for external custom matchers.
//     if (lines[i].includes('__EXTERNAL_MATCHER_TRAP__'))
//       return lines.slice(i + 1).join('\n')
//   }

//   return stack
// }

const escapeRegex = true
const printFunctionName = false

export function serialize(val: unknown,
  indent = 2,
  formatOverrides: PrettyFormatOptions = {}): string {
  return normalizeNewlines(
    prettyFormat(val, {
      escapeRegex,
      indent,
      plugins: getSerializers(),
      printFunctionName,
      ...formatOverrides,
    }),
  )
}

export function minify(val: unknown): string {
  return prettyFormat(val, {
    escapeRegex,
    min: true,
    plugins: getSerializers(),
    printFunctionName,
  })
}

// Remove double quote marks and unescape double quotes and backslashes.
export function deserializeString(stringified: string): string {
  return stringified.slice(1, -1).replace(/\\("|\\)/g, '$1')
}

export function escapeBacktickString(str: string): string {
  return str.replace(/`|\\|\${/g, '\\$&')
}

function printBacktickString(str: string): string {
  return `\`${escapeBacktickString(str)}\``
}

export function ensureDirectoryExists(filePath: string): void {
  try {
    fs.mkdirSync(path.join(path.dirname(filePath)), { recursive: true })
  }
  catch { }
}

function normalizeNewlines(string: string) {
  return string.replace(/\r\n|\r/g, '\n')
}

export function saveSnapshotFile(snapshotData: SnapshotData,
  snapshotPath: string): void {
  const snapshots = Object.keys(snapshotData)
    .sort(naturalCompare)
    .map(
      key => `exports[${printBacktickString(key)}] = ${printBacktickString(normalizeNewlines(snapshotData[key]))};`,
    )

  ensureDirectoryExists(snapshotPath)
  fs.writeFileSync(
    snapshotPath,
    `${writeSnapshotVersion()}\n\n${snapshots.join('\n\n')}\n`,
  )
}
