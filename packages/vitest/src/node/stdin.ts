import readline from 'readline'
import c from 'picocolors'
import type { Vitest } from './core'

const keys = [
  ['a', 'rerun all tests'],
  ['f', 'rerun only failed tests'],
  ['u', 'update snapshot'],
  ['t', 'change testNamePattern'],
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

  function endPattern() {
    ctx.changeNamePattern(namePattern, undefined, 'change pattern')
    namePattern = ''
    changingPattern = false
  }

  function startPattern() {
    process.stdout.write(`\n${c.bgYellow(' PATTERN ')} ${c.yellow('Change testNamePattern to:')} `)
    changingPattern = true
  }

  function appendPattern(str: string) {
    namePattern += str
    process.stdout.write(str)
  }

  return {
    changingPattern,
    endPattern,
    startPattern,
    appendPattern,
  }
}

export function registerConsoleShortcuts(ctx: Vitest) {
  const { changingPattern, endPattern, startPattern, appendPattern } = useChangePattern(ctx)

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

    if (changingPattern) {
      if (name === 'return')
        return endPattern()

      return appendPattern(name)
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
      return startPattern()

    // quit
    if (name === 'q')
      return ctx.exit(true)

    // TODO: add more commands
  })
}
