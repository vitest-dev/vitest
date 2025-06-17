/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of facebook/jest GitHub project tree.
 */

import type { ResolvedConfig } from '../node/types/config'
import * as nodeos from 'node:os'

function getDefaultThreadsCount(config: ResolvedConfig) {
  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  return config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)
}

export function getWorkerMemoryLimit(config: ResolvedConfig, pool: 'vmThreads' | 'vmForks'): string | number {
  if (pool === 'vmForks') {
    const opts = config.poolOptions?.vmForks ?? {}
    if (opts.memoryLimit) {
      return opts.memoryLimit
    }
    const workers = opts.maxForks ?? getDefaultThreadsCount(config)

    return 1 / workers
  }
  else {
    const opts = config.poolOptions?.vmThreads ?? {}
    if (opts.memoryLimit) {
      return opts.memoryLimit
    }
    const workers = opts.maxThreads ?? getDefaultThreadsCount(config)

    return 1 / workers
  }
}

/**
 * Converts a string representing an amount of memory to bytes.
 *
 * @param input The value to convert to bytes.
 * @param percentageReference The reference value to use when a '%' value is supplied.
 */
export function stringToBytes(
  input: string | number | null | undefined,
  percentageReference?: number,
): number | null | undefined {
  if (input === null || input === undefined) {
    return input
  }

  if (typeof input === 'string') {
    if (Number.isNaN(Number.parseFloat(input.slice(-1)))) {
      let [, numericString, trailingChars]
        // eslint-disable-next-line regexp/no-super-linear-backtracking
        = input.match(/(.*?)([^0-9.-]+)$/) || []

      if (trailingChars && numericString) {
        const numericValue = Number.parseFloat(numericString)
        trailingChars = trailingChars.toLowerCase()

        switch (trailingChars) {
          case '%':
            input = numericValue / 100
            break
          case 'kb':
          case 'k':
            return numericValue * 1000
          case 'kib':
            return numericValue * 1024
          case 'mb':
          case 'm':
            return numericValue * 1000 * 1000
          case 'mib':
            return numericValue * 1024 * 1024
          case 'gb':
          case 'g':
            return numericValue * 1000 * 1000 * 1000
          case 'gib':
            return numericValue * 1024 * 1024 * 1024
        }
      }

      // It ends in some kind of char so we need to do some parsing
    }
    else {
      input = Number.parseFloat(input)
    }
  }

  if (typeof input === 'number') {
    if (input <= 1 && input > 0) {
      if (percentageReference) {
        return Math.floor(input * percentageReference)
      }
      else {
        throw new Error(
          'For a percentage based memory limit a percentageReference must be supplied',
        )
      }
    }
    else if (input > 1) {
      return Math.floor(input)
    }
    else {
      throw new Error('Unexpected numerical input for "memoryLimit"')
    }
  }

  return null
}
