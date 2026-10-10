import type { MatchMeta, SnapshotEnvironment, SnapshotUpdate } from '@vitest/snapshot'
import type { TestError } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { Colors } from 'tinyrainbow'
import type { Test } from '../runtime/runner/types'
import type { Vitest } from './core'
import type { TestProject } from './project'
import { relative } from 'node:path'
import readline from 'node:readline'
import { saveSnapshotUpdates } from '@vitest/snapshot'
import c from 'tinyrainbow'
import { isCancelAction } from '../utils/stdin'
import { getTests, isSnapshotMatchError } from '../utils/tasks'
import { divider, formatProjectName } from './reporters/renderers/utils'

interface ReviewableSnapshot {
  error: Required<Pick<TestError, 'actual' | 'diff' | 'message'>>
  errorMeta: MatchMeta
  frame: NonNullable<TestError['stacks']>[number]
  test: Test
  project: TestProject
}
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

      if (project.config.snapshotEnvironment === undefined) {
        for (const test of getTests(files)) {
          if (test.result?.errors === undefined) {
            continue
          }

          for (const error of test.result.errors) {
            const frame = error.stacks?.[0]
            const errorMeta = error.__vitest_error_context__?.meta

            // @todo check if frame exists and improve this check
            if (
              isSnapshotMatchError(error) &&
              frame &&
              error.actual &&
              error.diff &&
              error.message &&
              errorMeta &&
              typeof errorMeta === 'object' &&
              'type' in errorMeta &&
              errorMeta.type === 'snapshot'
            ) {
              failedSnapshots.push({
                // @ts-expect-error error is not narrowed down enough @todo
                error,
                // @ts-expect-error meta field is not narrowed down enough @todo
                errorMeta,
                frame,
                test,
                project,
              })
            }
          }
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
      const snapshotContent =
        snapshot.errorMeta.kind !== 'raw' && snapshot.error.actual!.includes('\n')
          ? `\n${snapshot.error.actual}\n`
          : snapshot.error.actual
      let update: Update

      switch (snapshot.errorMeta.kind) {
        case 'inline': {
          update = {
            type: 'inline',
            file: snapshot.frame.file,
            line: snapshot.frame.line,
            column: snapshot.frame.column - 1,
            testId: snapshot.test.id,
            assertionName: snapshot.errorMeta.assertionName,
            snapshot: snapshotContent,
            meta: { test: snapshot.test },
          }
          break
        }

        case 'file': {
          update = {
            type: 'file',
            file: snapshot.errorMeta.file,
            key: snapshot.errorMeta.key,
            snapshot: snapshotContent,
            meta: { test: snapshot.test },
          }
          break
        }

        case 'raw': {
          update = {
            type: 'raw',
            file: snapshot.errorMeta.file,
            snapshot: snapshotContent,
            meta: { test: snapshot.test },
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

  async #updateSnapshots(): Promise<void> {
    const snapshotEnvironment = await this.getEnvironment()
    const snapshotUpdates = new Map<SnapshotEnvironment, SnapshotUpdate[]>([
      [snapshotEnvironment, this.#updates.approved],
    ])

    return saveSnapshotUpdates(snapshotUpdates)
  }

  public async startReview(): Promise<void> {
    this.ctx.watcher.unregisterWatcher()

    try {
      await this.collectReviews(this.#review)
      await this.#updateSnapshots()
      // @todo what should happen when there's no approved updates?
      await this.ctx.rerunFiles(
        Array.from(new Set(this.#updates.approved.map(({ meta }) => meta.test.file.filepath))),
        'interactive review done',
      )
    } finally {
      this.ctx.watcher.registerWatcher()
    }
  }

  public get hasReviewableSnapshots(): boolean {
    return this.snapshots.length > 0
  }
}

const CLEAR_SCREEN_SEQUENCE = '\x1B[H\x1B[J'
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
      await review(async ({ snapshot, stats }, approve, reject) => {
        this.#stdout.write(
          [
            CLEAR_SCREEN_SEQUENCE,
            c.bold(`Reviewing [${c.yellow(`${stats.index + 1}/${stats.length}`)}]`) +
              (snapshot.project.name ? ' ' + formatProjectName(snapshot.project, ':') : ':'),
            `Source: ${c.cyan(
              `${relative(snapshot.project.config.root, snapshot.frame.file)}${c.dim(`:${snapshot.frame.line}:${snapshot.frame.column}`)}`,
            )} ${c.dim(`(${snapshot.test.fullTestName})`)}`,
            snapshot.errorMeta.kind !== 'raw' && `Snapshot: ${c.yellow(snapshot.errorMeta.key)}`,
            snapshot.errorMeta.kind !== 'inline' &&
              `Snapshot file: ${c.cyan(relative(snapshot.project.config.root, snapshot.errorMeta.file))}`,
            divider(),
            snapshot.error.diff,
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
      })

      this.#stdout.write(CLEAR_SCREEN_SEQUENCE)
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
