/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Config, NewPlugin, Printer, Refs } from '../types'
import { printIteratorEntries, printIteratorValues } from '../collections'

// SENTINEL constants are from https://github.com/facebook/immutable-js
const IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@'
const IS_LIST_SENTINEL = '@@__IMMUTABLE_LIST__@@'
const IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@'
const IS_MAP_SENTINEL = '@@__IMMUTABLE_MAP__@@'
const IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@'
const IS_RECORD_SENTINEL = '@@__IMMUTABLE_RECORD__@@' // immutable v4
const IS_SEQ_SENTINEL = '@@__IMMUTABLE_SEQ__@@'
const IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@'
const IS_STACK_SENTINEL = '@@__IMMUTABLE_STACK__@@'

const getImmutableName = (name: string) => `Immutable.${name}`
const printAsLeaf = (name: string) => `[${name}]`
const SPACE = ' '
const LAZY = '…' // Seq is lazy if it calls a method like filter

function printImmutableEntries(
  val: any,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
  type: string,
): string {
  return ++depth > config.maxDepth
    ? printAsLeaf(getImmutableName(type))
    : `${getImmutableName(type) + SPACE}{${printIteratorEntries(
      val.entries(),
      config,
      indentation,
      depth,
      refs,
      printer,
    )}}`
}

// Record has an entries method because it is a collection in immutable v3.
// Return an iterator for Immutable Record from version v3 or v4.
function getRecordEntries(val: any): Iterator<any> {
  let i = 0
  return {
    next() {
      if (i < val._keys.length) {
        const key = val._keys[i++]
        return { done: false, value: [key, val.get(key)] }
      }
      return { done: true, value: undefined }
    },
  }
}

function printImmutableRecord(val: any, config: Config, indentation: string, depth: number, refs: Refs, printer: Printer): string {
  // _name property is defined only for an Immutable Record instance
  // which was constructed with a second optional descriptive name arg
  const name = getImmutableName(val._name || 'Record')
  return ++depth > config.maxDepth
    ? printAsLeaf(name)
    : `${name + SPACE}{${printIteratorEntries(
      getRecordEntries(val),
      config,
      indentation,
      depth,
      refs,
      printer,
    )}}`
}

function printImmutableSeq(val: any, config: Config, indentation: string, depth: number, refs: Refs, printer: Printer): string {
  const name = getImmutableName('Seq')

  if (++depth > config.maxDepth) {
    return printAsLeaf(name)
  }

  if (val[IS_KEYED_SENTINEL]) {
    return `${name + SPACE}{${
      // from Immutable collection of entries or from ECMAScript object
      val._iter || val._object
        ? printIteratorEntries(
            val.entries(),
            config,
            indentation,
            depth,
            refs,
            printer,
          )
        : LAZY
    }}`
  }

  return `${name + SPACE}[${
    val._iter // from Immutable collection of values
    || val._array // from ECMAScript array
    || val._collection // from ECMAScript collection in immutable v4
    || val._iterable // from ECMAScript collection in immutable v3
      ? printIteratorValues(
          val.values(),
          config,
          indentation,
          depth,
          refs,
          printer,
        )
      : LAZY
  }]`
}

function printImmutableValues(val: any, config: Config, indentation: string, depth: number, refs: Refs, printer: Printer, type: string): string {
  return ++depth > config.maxDepth
    ? printAsLeaf(getImmutableName(type))
    : `${getImmutableName(type) + SPACE}[${printIteratorValues(
      val.values(),
      config,
      indentation,
      depth,
      refs,
      printer,
    )}]`
}

export const serialize: NewPlugin['serialize'] = (
  val: any,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  printer: Printer,
) => {
  if (val[IS_MAP_SENTINEL]) {
    return printImmutableEntries(
      val,
      config,
      indentation,
      depth,
      refs,
      printer,
      val[IS_ORDERED_SENTINEL] ? 'OrderedMap' : 'Map',
    )
  }

  if (val[IS_LIST_SENTINEL]) {
    return printImmutableValues(
      val,
      config,
      indentation,
      depth,
      refs,
      printer,
      'List',
    )
  }
  if (val[IS_SET_SENTINEL]) {
    return printImmutableValues(
      val,
      config,
      indentation,
      depth,
      refs,
      printer,
      val[IS_ORDERED_SENTINEL] ? 'OrderedSet' : 'Set',
    )
  }
  if (val[IS_STACK_SENTINEL]) {
    return printImmutableValues(
      val,
      config,
      indentation,
      depth,
      refs,
      printer,
      'Stack',
    )
  }

  if (val[IS_SEQ_SENTINEL]) {
    return printImmutableSeq(val, config, indentation, depth, refs, printer)
  }

  // For compatibility with immutable v3 and v4, let record be the default.
  return printImmutableRecord(val, config, indentation, depth, refs, printer)
}

// Explicitly comparing sentinel properties to true avoids false positive
// when mock identity-obj-proxy returns the key as the value for any key.
export const test: NewPlugin['test'] = (val: any) =>
  val
  && (val[IS_ITERABLE_SENTINEL] === true || val[IS_RECORD_SENTINEL] === true)

const plugin: NewPlugin = { serialize, test }

export default plugin
