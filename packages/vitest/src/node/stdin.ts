import readline from 'readline'
import type { Vitest } from './core'

export function printShortcutsHelp() {

}

export function registerConsoleShortcuts(ctx: Vitest) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str: string, key: any) => {
    // ctrl-c or esc
    if (str === '\x03' || str === '\x1B' || (key && key.ctrl && key.name === 'c'))
      return ctx.exit()

    // is running, ignore keypress
    if (ctx.runningPromise)
      return

    const name = key?.name

    if (name === 'h') {
      printShortcutsHelp()
      return
    }
    if (name === 'u')
      return

    // press any key to exit on first run
    if (ctx.isFirstRun)
      return ctx.exit()

    // TODO: add more commands
  })
}
