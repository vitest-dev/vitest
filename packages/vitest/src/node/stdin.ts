import readline from 'readline'
import c from 'picocolors'
import prompt from 'prompts'
import { stdout } from '../utils'
import type { Vitest } from './core'

const keys = [
  ['a', 'rerun all tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['p', 'filter by a filename'],
  ['t', 'filter by a test name regex pattern'],
  ['q', 'quit'],
]

export function printShortcutsHelp() {
  stdout().write(
    `
${c.bold('  Watch Usage')}
${keys.map(i => c.dim('  press ') + c.reset(c.bold(i[0])) + c.dim(` to ${i[1]}`)).join('\n')}
`,
  )
}

export function registerConsoleShortcuts(ctx: Vitest) {
  let latestFilename = ''

  async function _keypressHandler(str: string, key: any) {
    // ctrl-c or esc
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c'))
      return ctx.exit(true)

    // is running, ignore keypress
    if (ctx.runningPromise)
      return

    const name = key?.name

    // quit
    if (name === 'q')
      return ctx.exit(true)

    // TODO typechecking doesn't support shortcuts this yet
    if (ctx.mode === 'typecheck')
      return

    // help
    if (name === 'h')
      return printShortcutsHelp()
    // update snapshot
    if (name === 'u')
      return ctx.updateSnapshot()
    // rerun all tests
    if (name === 'a' || name === 'return')
      return ctx.changeNamePattern('')
    // rerun only failed tests
    if (name === 'f')
      return ctx.rerunFailed()
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
    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input test name pattern (RegExp)',
      initial: ctx.config.testNamePattern?.source || '',
    }])
    await ctx.changeNamePattern(filter, undefined, 'change pattern')
    on()
  }

  async function inputFilePattern() {
    off()
    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input filename pattern',
      initial: latestFilename,
    }])
    latestFilename = filter
    await ctx.changeFilenamePattern(filter)
    on()
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
}
