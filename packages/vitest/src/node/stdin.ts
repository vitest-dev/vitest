import readline from 'node:readline'
import c from 'picocolors'
import prompt from 'prompts'
import { relative } from 'pathe'
import { getTests, isWindows, stdout } from '../utils'
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

    const filter = await createFilter('Input test name pattern (RegExp)', ctx.configOverride.testNamePattern?.source || '', async (str: string) => {
      const files = await ctx.state.getFiles()
      const tasks = files.map(file => file.tasks).flat()
      const tests = getTests(tasks)
      try {
        const reg = new RegExp(str)
        return tests.map(test => test.name).filter(testName => testName.match(reg))
      }
      catch {
        // `new RegExp` may throw error when input is invalid regexp
        return []
      }
    })
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
    const filter = await createFilter('Input filename pattern', latestFilename, async (str: string) => {
      const files = await ctx.globTestFiles([str])
      return files.map(file =>
        relative(ctx.config.root, file[1]),
      )
    })

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

  type FilterFunc = (str: string) => Promise<string[]>

async function createFilter(message: string, initial: string, filterFunc: FilterFunc) {
  let currentKeyword: string | undefined
  const filterRL = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 })
  readline.emitKeypressEvents(process.stdin, filterRL)
  if (process.stdin.isTTY)
    process.stdin.setRawMode(false)
  const handler = filterHandler(filterFunc)
  process.stdin.on('keypress', handler)

  const { filter = '' }: { filter: string } = await prompt([{
    name: 'filter',
    type: 'text',
    message,
    initial,
  }])

  filterRL.close()
  process.stdin.removeListener('keypress', handler)
  if (process.stdin.isTTY)
    process.stdin.setRawMode(false)

  return filter

  function restoreCursor() {
    const cursortPos = `? ${message} › `.length + (currentKeyword?.length || 0)
    stdout().write(`\u001B[${cursortPos}G`)
  }

  function filterHandler(filterFunc: FilterFunc) {
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
        const results = await filterFunc(currentKeyword)

        if (results.length === 0) {
          eraseAndPrint(`\nPattern matches no results`)
        }
        else {
          if (results.length > MAX_RESULT_COUNT) {
            eraseAndPrint(`\nPattern matches ${results.length} results`
           + `\n${results.slice(0, MAX_RESULT_COUNT).map(result => c.dim(` › ${result}`)).join('\n')}${
            c.dim(`\n   ...and ${results.length - MAX_RESULT_COUNT} more results`)}`)
          }
          else { eraseAndPrint(`\nPattern matches ${results.length} results` + `\n${results.map(result => c.dim(` › ${result}`)).join('\n')}`) }
        }
      }
      else {
        eraseAndPrint('\nPlease input filter pattern')
      }
      restoreCursor()
    }
  }
}

/**
 * Print string and back to original cursor position
 * @param str
 */
function eraseAndPrint(str: string) {
  const lineBreasks = str.split('\n').length - 1

  stdout().write('\u001B[J')
  stdout().write(str)
  stdout().write(`\u001B[${lineBreasks}A`)
}
