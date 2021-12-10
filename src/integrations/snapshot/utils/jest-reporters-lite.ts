/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path, { isAbsolute } from 'path'
import { pluralize } from 'jest-util'
import slash from 'slash'
import c from 'picocolors'
import { SnapshotSummary } from './types'

const formatTestPath = (rootDir: string, testPath: string) => {
  if (isAbsolute(testPath))
    testPath = path.relative(rootDir, testPath)

  const dirname = path.dirname(testPath)
  const basename = path.basename(testPath)
  return slash(c.dim(dirname + path.sep) + c.bold(basename))
}

const ARROW = ' \u203A '
const DOWN_ARROW = ' \u21B3 '
const DOT = ' \u2022 '
const FAIL_COLOR = (v: any) => c.bold(c.red(v))
const OBSOLETE_COLOR = (v: any) => c.bold(c.yellow(v))
const SNAPSHOT_ADDED = (v: any) => c.bold(c.green(v))
const SNAPSHOT_NOTE = c.dim
const SNAPSHOT_REMOVED = (v: any) => c.bold(c.green(v))
const SNAPSHOT_SUMMARY = c.bold
const SNAPSHOT_UPDATED = (v: any) => c.bold(c.green(v))

const updateCommand = 're-run mocha with `--update` to update them'

export const getSnapshotSummaryOutput = (
  rootDir: string,
  snapshots: SnapshotSummary,
): Array<string> => {
  const summary = []

  if (snapshots.added) {
    summary.push(
      `${SNAPSHOT_ADDED(
        `${ARROW + pluralize('snapshot', snapshots.added)} written `,
      )}from ${pluralize('test suite', snapshots.filesAdded)}.`,
    )
  }

  if (snapshots.unmatched) {
    summary.push(
      `${FAIL_COLOR(
        `${ARROW}${pluralize('snapshot', snapshots.unmatched)} failed`,
      )
      } from ${pluralize('test suite', snapshots.filesUnmatched)}. ${
        SNAPSHOT_NOTE(
          `Inspect your code changes or ${updateCommand} to update them.`,
        )}`,
    )
  }

  if (snapshots.updated) {
    summary.push(
      `${SNAPSHOT_UPDATED(
        `${ARROW + pluralize('snapshot', snapshots.updated)} updated `,
      )}from ${pluralize('test suite', snapshots.filesUpdated)}.`,
    )
  }

  if (snapshots.filesRemoved) {
    if (snapshots.didUpdate) {
      summary.push(
        `${SNAPSHOT_REMOVED(
          `${ARROW}${pluralize(
            'snapshot file',
            snapshots.filesRemoved,
          )} removed `,
        )}from ${pluralize('test suite', snapshots.filesRemoved)}.`,
      )
    }
    else {
      summary.push(
        `${OBSOLETE_COLOR(
          `${ARROW}${pluralize(
            'snapshot file',
            snapshots.filesRemoved,
          )} obsolete `,
        )
        }from ${pluralize('test suite', snapshots.filesRemoved)}. ${
          SNAPSHOT_NOTE(
            `To remove ${
              snapshots.filesRemoved === 1 ? 'it' : 'them all'
            }, ${updateCommand}.`,
          )}`,
      )
    }
  }
  if (snapshots.filesRemovedList && snapshots.filesRemovedList.length) {
    const [head, ...tail] = snapshots.filesRemovedList
    summary.push(`  ${DOWN_ARROW} ${DOT}${formatTestPath(rootDir, head)}`)

    tail.forEach((key) => {
      summary.push(`      ${DOT}${formatTestPath(rootDir, key)}`)
    })
  }

  if (snapshots.unchecked) {
    if (snapshots.didUpdate) {
      summary.push(
        `${SNAPSHOT_REMOVED(
          `${ARROW}${pluralize('snapshot', snapshots.unchecked)} removed `,
        )
        }from ${pluralize(
          'test suite',
          snapshots.uncheckedKeysByFile.length,
        )}.`,
      )
    }
    else {
      summary.push(
        `${OBSOLETE_COLOR(
          `${ARROW}${pluralize('snapshot', snapshots.unchecked)} obsolete `,
        )
        }from ${pluralize(
          'test suite',
          snapshots.uncheckedKeysByFile.length,
        )}. ${
          SNAPSHOT_NOTE(
            `To remove ${
              snapshots.unchecked === 1 ? 'it' : 'them all'
            }, ${updateCommand}.`,
          )}`,
      )
    }

    snapshots.uncheckedKeysByFile.forEach((uncheckedFile) => {
      summary.push(
        `  ${DOWN_ARROW}${formatTestPath(rootDir, uncheckedFile.filePath)}`,
      )

      uncheckedFile.keys.forEach((key) => {
        summary.push(`      ${DOT}${key}`)
      })
    })
  }

  if (summary.length)
    summary.unshift(SNAPSHOT_SUMMARY('Snapshot Summary'))

  return summary
}
