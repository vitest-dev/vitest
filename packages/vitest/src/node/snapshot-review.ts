import type { MatchMeta, SnapshotEnvironment, SnapshotUpdate } from '@vitest/snapshot'
import type { TestError } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { Colors } from 'tinyrainbow'
import type { Test } from '../runtime/runner/types'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { Track } from './watcher'
import { relative } from 'node:path'
import readline from 'node:readline'
import { saveSnapshotUpdates } from '@vitest/snapshot'
import c from 'tinyrainbow'
import { isCancelAction } from '../utils/stdin'
import { getTests, isSnapshotMatchError } from '../utils/tasks'
import { divider, formatProjectName } from './reporters/renderers/utils'

type Frame = NonNullable<TestError['stacks']>[number]
interface ReviewableSnapshotBase {
  error: Required<Pick<TestError, 'actual' | 'diff'>>
  test: Test
  project: TestProject
  frame: Frame | null
}
interface ReviewableSnapshotInline extends ReviewableSnapshotBase {
  errorMeta: Extract<MatchMeta, { kind: 'inline' }>
  frame: Frame
}
interface ReviewableSnapshotExternal extends ReviewableSnapshotBase {
  errorMeta: Extract<MatchMeta, { kind: 'file' | 'raw' }>
}
type ReviewableSnapshot = ReviewableSnapshotInline | ReviewableSnapshotExternal
type UpdateTypes = 'approved' | 'rejected'
type Update = SnapshotUpdate & {
  meta: { test: Test }
}
type InsertSnapshotUpdate = (snapshot: Update) => void
type Review = (
  render: (
    data: Readonly<{
      snapshot: ReviewableSnapshot
      stats: Readonly<{ index: number; length: number }>
    }>,
    approve: () => void,
    reject: () => void,
  ) => Promise<void>,
) => Promise<void>

abstract class SnapshotReviewer {
  protected ctx: Vitest
  protected snapshots: readonly ReviewableSnapshot[]

  #updates: Record<UpdateTypes, Update[]> = {
    approved: [],
    rejected: [],
  }

  constructor(ctx: Vitest) {
    this.ctx = ctx

    this.snapshots = this.#collectSnapshots()
  }

  #collectSnapshots(): ReviewableSnapshot[] {
    const failedSnapshots: ReviewableSnapshot[] = []

    for (const files of this.ctx.state.getFiles()) {
      const project = this.ctx.getProjectByName(files.projectName ?? '')

      if (project.config.snapshotEnvironment !== undefined) {
        continue
      }

      for (const test of getTests(files)) {
        if (test.result?.errors === undefined) {
          continue
        }

        for (const error of test.result.errors) {
          const reviewableSnapshot = getReviewableSnapshot(error)

          if (reviewableSnapshot === null) {
            continue
          }

          failedSnapshots.push({
            ...reviewableSnapshot,
            test,
            project,
          } satisfies ReviewableSnapshot)
        }
      }
    }

    return failedSnapshots
  }

  #approve: InsertSnapshotUpdate = (snapshot) => {
    this.#updates.approved.push(snapshot)
  }

  #reject: InsertSnapshotUpdate = (snapshot) => {
    this.#updates.rejected.push(snapshot)
  }

  #review: Review = async (render) => {
    for (const [index, snapshot] of this.snapshots.entries()) {
      const { error, errorMeta, test } = snapshot
      const snapshotContent =
        errorMeta.kind !== 'raw' && error.actual!.includes('\n')
          ? `\n${error.actual}\n`
          : error.actual
      let update: Update

      switch (errorMeta.kind) {
        case 'inline': {
          const { frame } = snapshot as ReviewableSnapshotInline

          update = {
            type: 'inline',
            file: frame.file,
            line: frame.line,
            column: frame.column - 1,
            testId: test.id,
            assertionName: errorMeta.assertionName,
            snapshot: snapshotContent,
            meta: { test },
          }
          break
        }

        case 'file': {
          update = {
            type: 'file',
            file: errorMeta.file,
            key: errorMeta.key,
            snapshot: snapshotContent,
            meta: { test },
          }
          break
        }

        case 'raw': {
          update = {
            type: 'raw',
            file: errorMeta.file,
            snapshot: snapshotContent,
            meta: { test },
          }
          break
        }
      }

      await render(
        {
          snapshot,
          stats: {
            index,
            length: this.snapshots.length,
          },
        },
        () => this.#approve(update),
        () => this.#reject(update),
      )
    }
  }

  protected abstract collectReviews(review: Review): Promise<void>
  protected abstract getEnvironment(): Promise<SnapshotEnvironment>

  async #updateSnapshots(trackFS: Track): Promise<void> {
    const snapshotEnvironment = await this.getEnvironment()
    const snapshotUpdates = new Map<SnapshotEnvironment, SnapshotUpdate[]>([
      [snapshotEnvironment, this.#updates.approved],
    ])

    return saveSnapshotUpdates(snapshotUpdates, trackFS)
  }

  public async startReview(): Promise<void> {
    this.ctx.watcher.unregisterWatcher()
    const tracker = this.ctx.watcher.createTracker()

    try {
      await this.collectReviews(this.#review)
      await this.#updateSnapshots(tracker.track)

      for (const file of new Set(this.#updates.approved.map(({ file }) => file))) {
        this.ctx.logger.clearHighlightCache(file)
        this.ctx.invalidateFile(file)
      }
      this.ctx.watcher.registerWatcher()

      // @todo what should happen when there's no approved updates?
      await this.ctx.rerunFiles(
        Array.from(new Set(this.#updates.approved.map(({ meta }) => meta.test.file.filepath))),
        'interactive review done',
      )
    } catch (error) {
      console.error(error)
    } finally {
      tracker.stop()
      this.ctx.watcher.registerWatcher()
    }
  }

  public get hasReviewableSnapshots(): boolean {
    return this.snapshots.length > 0
  }
}

function getReviewableSnapshot(
  error: TestError,
):
  | Omit<ReviewableSnapshotInline, 'project' | 'test'>
  | Omit<ReviewableSnapshotExternal, 'project' | 'test'>
  | null {
  const frame = error.stacks?.[0] ?? null
  const errorMeta = error.__vitest_error_context__?.meta

  if (
    isSnapshotMatchError(error) &&
    typeof error.actual === 'string' &&
    typeof error.diff === 'string' &&
    errorMeta &&
    Reflect.get(errorMeta, 'type') === 'snapshot'
  ) {
    const matchMeta = errorMeta as ReviewableSnapshot['errorMeta']

    if (matchMeta.kind === 'inline' && frame === null) {
      return null
    }

    // TS cannot narrow down the type even tho we guard inline snapshots with `null` frames
    return {
      error: error as ReviewableSnapshot['error'],
      errorMeta: matchMeta,
      frame,
    } as ReturnType<typeof getReviewableSnapshot>
  }

  return null
}

const REVIEW_KEYS: readonly [
  key: string,
  color: keyof Colors extends infer C
    ? C extends keyof Colors
      ? Colors[C] extends (input: unknown) => string
        ? C
        : never
      : never
    : never,
  meaning: string,
  description: string,
][] = [
  ['a', 'green', 'accept', 'keep the new snapshot'],
  ['r', 'red', 'reject', 'retain the old snapshot'],
  // @todo implement later as part of #8403
  // ['s', 'yellow', 'skip', 'keep both for now'],
]
const REVIEW_DESCRIPTION_PADDING = Math.max(...REVIEW_KEYS.map((k) => k[2].length)) + 2
const REVIEW_KEYS_HELP = `\n${REVIEW_KEYS.map(
  ([key, color, meaning, description]) =>
    `  ${c[color](key)} ${c.reset(meaning)}${' '.repeat(
      REVIEW_DESCRIPTION_PADDING - meaning.length,
    )}${c.dim(description)}`,
).join('\n')}\n`

export class NodeSnapshotReviewer extends SnapshotReviewer {
  #stdin: NodeJS.ReadStream
  #stdout: NodeJS.WriteStream | Writable

  #snapshotEnvironment: SnapshotEnvironment | undefined = undefined

  constructor(ctx: Vitest, stdin: NodeJS.ReadStream, stdout: NodeJS.WriteStream | Writable) {
    super(ctx)

    this.#stdin = stdin
    this.#stdout = stdout
  }

  protected async getEnvironment(): Promise<SnapshotEnvironment> {
    if (this.#snapshotEnvironment === undefined) {
      this.#snapshotEnvironment = new (
        await import('../integrations/snapshot/environments/node')
      ).VitestNodeSnapshotEnvironment()
    }

    return this.#snapshotEnvironment
  }

  protected async collectReviews(review: Review): Promise<void> {
    const controls = this.#handleKeypress()

    try {
      await review(
        async (
          { snapshot: { error, errorMeta, frame, project, test }, stats },
          approve,
          reject,
        ) => {
          this.ctx.logger.clearFullScreen()

          this.#stdout.write(
            [
              c.bold(`Reviewing [${c.yellow(`${stats.index + 1}/${stats.length}`)}]`) +
                (project.name ? ' ' + formatProjectName(project, ':') : ':'),
              frame &&
                `Source: ${c.cyan(
                  `${relative(project.config.root, frame.file)}${c.dim(`:${frame.line}:${frame.column}`)}`,
                )} ${c.dim(`(${test.fullTestName})`)}`,
              errorMeta.kind !== 'raw' && `Snapshot: ${c.yellow(errorMeta.key)}`,
              errorMeta.kind !== 'inline' &&
                `Snapshot file: ${c.cyan(relative(project.config.root, errorMeta.file))}`,
              divider(),
              error.diff,
              divider(),
              REVIEW_KEYS_HELP,
            ]
              .filter(Boolean)
              .join('\n'),
          )

          const action = await controls.waitForAction()

          switch (action) {
            case 'approved': {
              approve()
              break
            }

            case 'rejected': {
              reject()
              break
            }
          }
        },
      )

      this.ctx.logger.clearFullScreen()
    } catch (error) {
      controls.cleanup()

      // `waitForAction` can reject when pressing cancel keys, no need to log that
      if (error) {
        console.error(error)
      }

      await this.ctx.exit(true)
    }

    controls.cleanup()
  }

  #handleKeypress(): {
    waitForAction: () => Promise<UpdateTypes>
    cleanup: () => void
  } {
    let resolvers: PromiseWithResolvers<UpdateTypes> | undefined
    const rl = readline.createInterface({ input: this.#stdin, escapeCodeTimeout: 50 })

    readline.emitKeypressEvents(this.#stdin, rl)

    if (this.#stdin.isTTY) {
      this.#stdin.setRawMode(true)
    }

    this.#stdin.on('keypress', handler)

    const cleanup = () => {
      rl.close()

      this.#stdin.removeListener('keypress', handler)

      if (this.#stdin.isTTY) {
        this.#stdin.setRawMode(false)
      }
    }

    function handler(str: string, key: readline.Key) {
      if (resolvers === undefined) {
        return
      }

      const currentResolvers = resolvers

      // reset the resolvers so a cancel key string won't change the exit code without rejecting
      resolvers = undefined

      if (isCancelAction(str, key)) {
        process.exitCode = 130

        cleanup()

        return currentResolvers.reject()
      }

      switch (key.name) {
        // accept
        case 'a': {
          currentResolvers.resolve('approved')
          break
        }

        // reject
        case 'r': {
          currentResolvers.resolve('rejected')
          break
        }

        // ignore other keys
        default: {
          // restore resolvers as we didn't resolve the promise
          resolvers = currentResolvers
          break
        }
      }
    }

    return {
      waitForAction() {
        resolvers = Promise.withResolvers()

        return resolvers.promise
      },
      cleanup,
    }
  }
}
