import readline from 'node:readline'
import c from 'picocolors'
import prompt from 'prompts'
import ansiEscapes from 'ansi-escapes'
import { relative } from 'pathe'
import type { Task, Test } from '@vitest/runner/types/tasks'
import { isWindows, stdout } from '../utils'
import { toArray } from '../utils/base'
import type { Vitest } from './core'

const keys = [
  [['a', 'return'], 'rerun all tests'],
  ['r', 'rerun current pattern tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['p', 'filter by a filename'],
  ['t', 'filter by a test name regex pattern'],
  ['w', 'filter by a project name'],
  ['q', 'quit'],
]
const cancelKeys = ['space', 'c', 'h', ...keys.map(key => key[0]).flat()]

export function printShortcutsHelp() {
  stdout().write(
    `
${c.bold('  Watch Usage')}
${keys.map(i => c.dim('  press ') + c.reset([i[0]].flat().map(c.bold).join(', ')) + c.dim(` to ${i[1]}`)).join('\n')}
`,
  )
}

export function registerConsoleShortcuts(ctx: Vitest) {
  let latestFilename = ''

  async function _keypressHandler(str: string, key: any) {
    // Cancel run and exit when ctrl-c or esc is pressed.
    // If cancelling takes long and key is pressed multiple times, exit forcefully.
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c')) {
      if (!ctx.isCancelling) {
        ctx.logger.logUpdate.clear()
        ctx.logger.log(c.red('Cancelling test run. Press CTRL+c again to exit forcefully.\n'))
        process.exitCode = 130

        await ctx.cancelCurrentRun('keyboard-input')
        await ctx.runningPromise
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
      if (cancelKeys.includes(name))
        await ctx.cancelCurrentRun('keyboard-input')
      return
    }

    // quit
    if (name === 'q')
      return ctx.exit(true)

    // help
    if (name === 'h')
      return printShortcutsHelp()
    // update snapshot
    if (name === 'u')
      return ctx.updateSnapshot()
    // rerun all tests
    if (name === 'a' || name === 'return')
      return ctx.changeNamePattern('')
    // rerun current pattern tests
    if (name === 'r')
      return ctx.rerunFiles()
    // rerun only failed tests
    if (name === 'f')
      return ctx.rerunFailed()
    // change project filter
    if (name === 'w')
      return inputProjectName()
    // change testNamePattern
    if (name === 't')
      return inputNamePattern()
    // change fileNamePattern
    if (name === 'p')
      return inputFilePattern()
  }

  async function keypressHandler(str: string, key: any) {
    await _keypressHandler(str, key)
  }

  async function inputNamePattern() {
    off()
    const cleanUp = startSearchMode(async (str: string) => {
      const files = await ctx.state.getFiles()
      const tasks = files.map(file => file.tasks).flat()
      const tests = extractTest(tasks)
      try {
        const reg = new RegExp(str)
        return tests.map(test => test.name).filter(testName => testName.match(reg))
      }
      catch {
        // `new RegExp` may throw error when input is invalid regexp
        return []
      }
    },
    )
    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input test name pattern (RegExp)',
      initial: ctx.configOverride.testNamePattern?.source || '',
    }])
    cleanUp()
    on()
    await ctx.changeNamePattern(filter.trim(), undefined, 'change pattern')
  }

  async function inputProjectName() {
    off()
    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input a single project name',
      initial: toArray(ctx.configOverride.project)[0] || '',
    }])
    on()
    await ctx.changeProjectName(filter.trim())
  }

  async function inputFilePattern() {
    off()
    const cleanUp = startSearchMode(async (str: string) => {
      const files = await ctx.globTestFiles([str])
      return files.map(file =>
        relative(ctx.config.root, file[1]),
      )
    },
    )

    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input filename pattern',
      initial: latestFilename,
    }])
    cleanUp()
    latestFilename = filter.trim()
    on()
    await ctx.changeFilenamePattern(filter.trim())
  }

  let rl: readline.Interface | undefined
  function on() {
    off()
    rl = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 })
    readline.emitKeypressEvents(process.stdin, rl)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(true)
    process.stdin.on('keypress', keypressHandler)
  }

  function off() {
    rl?.close()
    rl = undefined
    process.stdin.removeListener('keypress', keypressHandler)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false)
  }

  on()

  return function cleanup() {
    off()
  }
}

  type SearchFunc = (str: string) => Promise<string[]>

function startSearchMode(searchFunc: SearchFunc) {
  const searchRL = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 })
  readline.emitKeypressEvents(process.stdin, searchRL)
  if (process.stdin.isTTY)
    process.stdin.setRawMode(false)
  const handler = searchHandler(searchFunc)
  process.stdin.on('keypress', handler)
  /** return tear down method */
  return () => {
    searchRL.close()
    process.stdin.removeListener('keypress', handler)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false)
  }
}

/**
 * Print string and back to original cursor position
 * @param str
 */
function eraceAndPrint(str: string) {
  const lineBreasks = str.split('\n').length - 1

  stdout().write(ansiEscapes.eraseDown)
  stdout().write(str)
  stdout().write(ansiEscapes.cursorUp(lineBreasks))
}

function searchHandler(searchFunc: SearchFunc) {
  let currentKeyword: string | undefined

  const MAX_RESULT_COUNT = 10
  return async function (str: string, key: any) {
    // backspace
    if (key.sequence === '\x7F') {
      if (currentKeyword && currentKeyword?.length > 1)

        currentKeyword = currentKeyword?.slice(0, -1)

      else
        currentKeyword = undefined
    }
    else if (key?.name === 'return') {
      // reset current keyword
      currentKeyword = undefined
      return
    }
    else {
      if (currentKeyword === undefined)
        currentKeyword = str
      else
        currentKeyword += str
    }

    if (currentKeyword) {
      const files = await searchFunc(currentKeyword)

      if (files.length === 0) {
        eraceAndPrint(`\nPattern matches no files`)
      }
      else {
        if (files.length > MAX_RESULT_COUNT) {
          eraceAndPrint(`\nPattern matches ${files.length} files`
           + `\n${files.slice(0, MAX_RESULT_COUNT).map(file => c.dim(` › ${file}`)).join('\n')}${
            c.dim(`\n   ...and ${files.length - MAX_RESULT_COUNT} more files`)}`)
        }
        else { eraceAndPrint(`\nPattern matches ${files.length} files` + `\n${files.map(file => c.dim(` › ${file}`)).join('\n')}`) }
      }
    }
    else {
      eraceAndPrint('\nPlease input filename pattern')
    }
  }
}

function extractTest(tasks: Task[]): Test[] {
  return tasks.flatMap((task) => {
    if (task.type === 'test')
      return [task]

    else if (task.type === 'suite')
      return extractTest(task.tasks)
    else return []
  })
}
