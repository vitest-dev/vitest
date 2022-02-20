import readline from 'readline'
import c from 'picocolors'
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

function useChangePattern(ctx: Vitest) {
  let namePattern = ''
  let changingPattern = false

  function end() {
    ctx.changeNamePattern(namePattern, undefined, 'change pattern')
    namePattern = ''
    changingPattern = false
  }

  function start() {
    process.stdout.write(`\n${c.bgMagenta(' PATTERN ')} ${c.magenta('Filter tests by its name regexp pattern:')} `)
    changingPattern = true
  }

  function append(str: string) {
    namePattern += str
    process.stdout.write(str)
  }

  return {
    get isChanging() {
      return changingPattern
    },
    end,
    start,
    append,
  }
}

export function registerConsoleShortcuts(ctx: Vitest) {
  const pattern = useChangePattern(ctx)

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

    if (pattern.isChanging) {
      if (name === 'return')
        return pattern.end()

      return pattern.append(name)
    }

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
      return pattern.start()

    // quit
    if (name === 'q')
      return ctx.exit(true)

    // TODO: add more commands
  })
}
