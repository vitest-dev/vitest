import readline from 'readline'
import c from 'picocolors'
import prompt from 'prompts'
import type { Vitest } from './core'

const keys = [
  ['a', 'rerun all tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['t', 'filter by a test name regex pattern'],
  ['q', 'quit'],
]

export function printShortcutsHelp() {
  process.stdout.write(
    `
${c.bold('  Watch Usage')}
${keys.map(i => c.dim('  press ') + c.reset(c.bold(i[0])) + c.dim(` to ${i[1]}`)).join('\n')}
`,
  )
}

export function registerConsoleShortcuts(ctx: Vitest) {
  async function _keypressHandler(str: string, key: any) {
    // ctrl-c or esc
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c'))
      return ctx.exit(true)

    // is running, ignore keypress
    if (ctx.runningPromise)
      return

    const name = key?.name

    // help
    if (name === 'h')
      return printShortcutsHelp()
    // update snapshot
    if (name === 'u')
      return ctx.updateSnapshot()
    // rerun all tests
    if (name === 'a' || name === 'return')
      return ctx.rerunFiles(undefined, 'rerun all')
    // change testNamePattern
    if (name === 't')
      return inputNamePattern()
    // quit
    if (name === 'q')
      return ctx.exit(true)
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
      initial: String(ctx.config.testNamePattern || ''),
    }])
    await ctx.changeNamePattern(filter, undefined, 'change pattern')
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
