import readline from 'readline'
import c from 'picocolors'
import type { Vitest } from './core'

const keys = [
  ['a', 'rerun all tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['q', 'quit'],
]

export function printShortcutsHelp() {
  process.stdout.write(
    `
${c.bold('  Watch Usage')}
${keys.map(i => c.dim('  press ') + c.bold(c.reset(i[0])) + c.dim(` to ${i[1]}`)).join('\n')}
`,
  )
}

export function registerConsoleShortcuts(ctx: Vitest) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str: string, key: any) => {
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
    // quit
    if (name === 'q')
      return ctx.exit(true)

    // TODO: add more commands
  })
}
