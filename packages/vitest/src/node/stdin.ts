import type { Writable } from 'node:stream'
import type { File, Task } from '../runtime/runner/types'
import type { Vitest } from './core'
import type { FilterObject } from './watch-filter'
import readline from 'node:readline'
import { relative, resolve } from 'pathe'
import prompt from 'prompts'
import c from 'tinyrainbow'
import { stdout } from '../utils/base'
import { isWindows } from '../utils/env'
import { isCancelAction } from '../utils/stdin'
import { NodeSnapshotReviewer } from './snapshot-review'
import { WatchFilter } from './watch-filter'

const keys = [
  [['a', 'return'], 'rerun all tests'],
  ['r', 'rerun current pattern tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['i', 'interactively review snapshot fails'],
  ['p', 'filter by a filename'],
  ['t', 'filter by a test name regex pattern'],
  ['w', 'filter by a project name'],
  ['q', 'quit'],
]

const cancelKeys = ['space', 'c', 'h', ...keys.map((key) => key[0]).flat()]

function printWatchHelp(): void {
  stdout().write(
    `
${c.bold('  Watch Usage')}
${keys
  .map(
    (i) => c.dim('  press ') + c.reset([i[0]].flat().map(c.bold).join(', ')) + c.dim(` to ${i[1]}`),
  )
  .join('\n')}
`,
  )
}

function* traverseFilteredTestNames(
  parentName: string,
  filter: RegExp,
  t: Task,
): Generator<FilterObject> {
  if (t.type === 'test') {
    if (filter.test(t.name)) {
      const displayName = `${parentName} > ${t.name}`
      yield { key: t.name, toString: () => displayName }
    }
  } else {
    parentName = parentName.length ? `${parentName} > ${t.name}` : t.name
    for (const task of t.tasks) {
      yield* traverseFilteredTestNames(parentName, filter, task)
    }
  }
}

function* getFilteredTestNames(pattern: string, suite: File[]): Generator<FilterObject> {
  try {
    const reg = new RegExp(pattern)
    // TODO: we cannot run tests per workspace yet: filtering files
    const files = new Set<string>()
    for (const file of suite) {
      if (!files.has(file.name)) {
        files.add(file.name)
        yield* traverseFilteredTestNames('', reg, file)
      }
    }
  } catch {
    // `new RegExp` may throw error when input is invalid regexp
  }
}

export function registerConsoleShortcuts(
  ctx: Vitest,
  stdin: NodeJS.ReadStream | undefined = process.stdin,
  stdout: NodeJS.WriteStream | Writable,
) {
  let latestFilename = ''

  async function _keypressHandler(str: string, key: readline.Key) {
    // Cancel run and exit when ctrl-c or esc is pressed.
    // If cancelling takes long and key is pressed multiple times, exit forcefully.
    if (isCancelAction(str, key)) {
      if (!ctx.isCancelling) {
        ctx.logger.log(c.red('Cancelling test run. Press CTRL+c again to exit forcefully.\n'))
        process.exitCode = 130

        // Unregister raw mode so that second CTRL+c is handled by Node.js as SIGINT
        off()

        await ctx.cancelCurrentRun('keyboard-input')
      }

      return ctx.exit(true)
    }

    // window not support suspend
    if (!isWindows && key && key.ctrl && key.name === 'z') {
      process.kill(process.ppid, 'SIGTSTP')
      process.kill(process.pid, 'SIGTSTP')
      return
    }

    const name = key?.name

    if (ctx.runningPromise) {
      if (name && cancelKeys.includes(name)) {
        await ctx.cancelCurrentRun('keyboard-input')
      }
      return
    }

    // quit
    if (name === 'q') {
      return ctx.exit(true)
    }

    // help
    if (name === 'h') {
      return printWatchHelp()
    }
    // update snapshot
    if (name === 'u') {
      return ctx.updateSnapshot()
    }
    // interactive review
    if (name === 'i') {
      return reviewSnapshots()
    }
    // rerun all tests
    if (name === 'a' || name === 'return') {
      const files = await ctx._globTestFilepaths()
      return ctx.changeNamePattern('', files, 'rerun all tests')
    }
    // rerun current pattern tests
    if (name === 'r') {
      return ctx.rerunFiles()
    }
    // rerun only failed tests
    if (name === 'f') {
      return ctx.rerunFailed()
    }
    // change project filter
    if (name === 'w') {
      return inputProjectName()
    }
    // change testNamePattern
    if (name === 't') {
      return inputNamePattern()
    }
    // change fileNamePattern
    if (name === 'p') {
      return inputFilePattern()
    }
  }

  async function keypressHandler(str: string, key: readline.Key) {
    await _keypressHandler(str, key)
  }

  async function reviewSnapshots() {
    off()

    const snapshotReviewer = new NodeSnapshotReviewer(ctx, stdin, stdout)

    if (snapshotReviewer.hasReviewableSnapshots) {
      await snapshotReviewer.startReview()
    } else {
      ctx.logger.log(
        c.yellow(
          `No snapshots to review. ${c.dim('Press ') + c.bold('r') + c.dim(' to run tests again.')}\n`,
        ),
      )
    }

    on()

    //   ctx.logger.log(
    //     `${c.bold('Snapshot review finished')}\n\n${
    //       updates.approved.length > 0
    //         ? `${c.green('Accepted')}:\n${updates.approved.map(({ meta }) => `  ${meta.frame} (${meta.snapshot})`).join('\n')}\n`
    //         : ''
    //     }${
    //       updates.rejected.length > 0
    //         ? `${c.red('Rejected')}:\n${updates.rejected.map(({ meta }) => `  ${meta.frame} (${meta.snapshot})`).join('\n')}\n`
    //         : ''
    //     }`,
    //   )
  }

  async function inputNamePattern() {
    off()
    const watchFilter = new WatchFilter<'object'>('Input test name pattern (RegExp)', stdin, stdout)
    const filter = await watchFilter.filter((str: string) => {
      return [...getFilteredTestNames(str, ctx.state.getFiles())]
    })

    on()

    if (typeof filter === 'undefined') {
      return
    }

    const files = ctx.state.getFilepaths()
    // if running in standalone mode, Vitest instance doesn't know about any test file
    const cliFiles =
      ctx.config.standalone && !files.length ? await ctx._globTestFilepaths() : undefined

    await ctx.changeNamePattern(filter?.trim() || '', cliFiles, 'change pattern')
  }

  async function inputProjectName() {
    off()
    const { filter = '' }: { filter: string } = await prompt([
      {
        name: 'filter',
        type: 'text',
        message: 'Input a single project name',
        initial: ctx.config.project[0] || '',
      },
    ])
    on()
    await ctx.changeProjectName(filter.trim())
  }

  async function inputFilePattern() {
    off()

    const watchFilter = new WatchFilter('Input filename pattern', stdin, stdout)

    const filter = await watchFilter.filter(async (str: string) => {
      const specifications = await ctx.globTestSpecifications([str])

      return specifications
        .map((specification) => relative(ctx.config.root, specification.moduleId))
        .filter((file, index, all) => all.indexOf(file) === index)
    })

    on()

    if (typeof filter === 'undefined') {
      return
    }

    latestFilename = filter?.trim() || ''
    const lastResults = watchFilter.getLastResults()

    await ctx.changeFilenamePattern(
      latestFilename,
      filter && lastResults.length
        ? lastResults.map((i) => resolve(ctx.config.root, i))
        : undefined,
    )
  }

  let rl: readline.Interface | undefined
  function on() {
    off()
    rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 })
    readline.emitKeypressEvents(stdin, rl)
    if (stdin.isTTY) {
      stdin.setRawMode(true)
    }
    stdin.on('keypress', keypressHandler)
  }

  function off() {
    rl?.close()
    rl = undefined
    stdin.removeListener('keypress', keypressHandler)
    if (stdin.isTTY) {
      stdin.setRawMode(false)
    }
  }

  on()

  return function cleanup(): void {
    off()
  }
}
