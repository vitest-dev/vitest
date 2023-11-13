/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import naturalCompare from 'natural-compare'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import {
  format as prettyFormat,
} from 'pretty-format'
import { isObject } from '../../../utils/src/index'
import type { SnapshotData, SnapshotStateOptions } from '../types'
import type { SnapshotEnvironment } from '../types/environment'
import { getSerializers } from './plugins'

// TODO: rewrite and clean up

export function testNameToKey(testName: string, count: number): string {
  return `${testName} ${count}`
}

export function keyToTestName(key: string): string {
  if (!/ \d+$/.test(key))
    throw new Error('Snapshot keys must end with a number.')

  return key.replace(/ \d+$/, '')
}

export function getSnapshotData(content: string | null, options: SnapshotStateOptions): {
  data: SnapshotData
  dirty: boolean
} {
  const update = options.updateSnapshot
  const data = Object.create(null)
  let snapshotContents = ''
  let dirty = false

  if (content != null) {
    try {
      snapshotContents = content
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
export function addExtraLineBreaks(string: string): string {
  return string.includes('\n') ? `\n${string}\n` : string
}

// Remove extra line breaks at beginning and end of multiline snapshot.
// Instead of trim, which can remove additional newlines or spaces
// at beginning or end of the content from a custom serializer.
export function removeExtraLineBreaks(string: string): string {
  return (string.length > 2 && string.startsWith('\n') && string.endsWith('\n'))
    ? string.slice(1, -1)
    : string
}

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

export function serialize(val: unknown, indent = 2, formatOverrides: PrettyFormatOptions = {}): string {
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

export function normalizeNewlines(string: string) {
  return string.replace(/\r\n|\r/g, '\n')
}

export async function saveSnapshotFile(
  environment: SnapshotEnvironment,
  snapshotData: SnapshotData,
  snapshotPath: string,
) {
  const snapshots = Object.keys(snapshotData)
    .sort(naturalCompare)
    .map(
      key => `exports[${printBacktickString(key)}] = ${printBacktickString(normalizeNewlines(snapshotData[key]))};`,
    )

  const content = `${environment.getHeader()}\n\n${snapshots.join('\n\n')}\n`
  const oldContent = await environment.readSnapshotFile(snapshotPath)
  const skipWriting = oldContent != null && oldContent === content

  if (skipWriting)
    return

  await environment.saveSnapshotFile(
    snapshotPath,
    content,
  )
}

export async function saveSnapshotFileRaw(
  environment: SnapshotEnvironment,
  content: string,
  snapshotPath: string,
) {
  const oldContent = await environment.readSnapshotFile(snapshotPath)
  const skipWriting = oldContent != null && oldContent === content

  if (skipWriting)
    return

  await environment.saveSnapshotFile(
    snapshotPath,
    content,
  )
}

export function prepareExpected(expected?: string) {
  function findStartIndent() {
    // Attempts to find indentation for objects.
    // Matches the ending tag of the object.
    const matchObject = /^( +)}\s+$/m.exec(expected || '')
    const objectIndent = matchObject?.[1]?.length

    if (objectIndent)
      return objectIndent

    // Attempts to find indentation for texts.
    // Matches the quote of first line.
    const matchText = /^\n( +)"/.exec(expected || '')
    return matchText?.[1]?.length || 0
  }

  const startIndent = findStartIndent()

  let expectedTrimmed = expected?.trim()

  if (startIndent) {
    expectedTrimmed = expectedTrimmed
      ?.replace(new RegExp(`^${' '.repeat(startIndent)}`, 'gm'), '').replace(/ +}$/, '}')
  }

  return expectedTrimmed
}

function deepMergeArray(target: any[] = [], source: any[] = []) {
  const mergedOutput = Array.from(target)

  source.forEach((sourceElement, index) => {
    const targetElement = mergedOutput[index]

    if (Array.isArray(target[index])) {
      mergedOutput[index] = deepMergeArray(target[index], sourceElement)
    }
    else if (isObject(targetElement)) {
      mergedOutput[index] = deepMergeSnapshot(target[index], sourceElement)
    }
    else {
      // Source does not exist in target or target is primitive and cannot be deep merged
      mergedOutput[index] = sourceElement
    }
  })

  return mergedOutput
}

/**
 * Deep merge, but considers asymmetric matchers. Unlike base util's deep merge,
 * will merge any object-like instance.
 * Compatible with Jest's snapshot matcher. Should not be used outside of snapshot.
 *
 * @example
 * ```ts
 * toMatchSnapshot({
 *   name: expect.stringContaining('text')
 * })
 * ```
 */
export function deepMergeSnapshot(target: any, source: any): any {
  if (isObject(target) && isObject(source)) {
    const mergedOutput = { ...target }
    Object.keys(source).forEach((key) => {
      if (isObject(source[key]) && !source[key].$$typeof) {
        if (!(key in target))
          Object.assign(mergedOutput, { [key]: source[key] })
        else mergedOutput[key] = deepMergeSnapshot(target[key], source[key])
      }
      else if (Array.isArray(source[key])) {
        mergedOutput[key] = deepMergeArray(target[key], source[key])
      }
      else {
        Object.assign(mergedOutput, { [key]: source[key] })
      }
    })

    return mergedOutput
  }
  else if (Array.isArray(target) && Array.isArray(source)) {
    return deepMergeArray(target, source)
  }
  return target
}
