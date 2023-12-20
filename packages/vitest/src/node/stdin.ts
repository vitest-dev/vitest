import readline from 'node:readline'
import c from 'picocolors'
import prompt from 'prompts'
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
    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: 'Input test name pattern (RegExp)',
      initial: ctx.configOverride.testNamePattern?.source || '',
    }])
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
    const allFiles = ctx.state.getFilepaths()
    const allFilesSet = new Set(allFiles)
    async function filterFiles(input: string) {
      const globTestFiles = await ctx.globTestFiles([input])
      return globTestFiles.map(spec => spec[1]).filter(v => allFilesSet.has(v))
    }
    let input = latestFilename
    let init = true
    let multiple = true
    let cancelled = false
    function getMessage() {
      return `Run ${multiple ? 'all matched files' : 'single selected file'} (press 'Space' to toggle)\n`
    }
    const result = await prompt({
      name: 'filter',
      type: 'autocomplete',
      message: getMessage(),
      choices: allFiles.map(v => ({ title: v })),
      async suggest(this: any, input_) {
        // use first suggest callback to customize
        if (init) {
          init = false

          // fix initial state
          input_ = latestFilename
          this.input = latestFilename
          this.cursor = latestFilename.length
          this.fallback = ''

          // monkey-patch Prompt instance for custom single/multi 'Space' toggle
          // https://github.com/terkelg/prompts/blob/735603af7c7990ac9efcfba6146967a7dbb15f50/lib/elements/autocomplete.js#L132
          const original = this._
          this._ = function (this: any, str: string, key: any) {
            if (str === ' ') {
              multiple = !multiple
              this.msg = getMessage()
              this.render()
              return
            }
            original.apply(this, [str, key])
          }
        }
        input = input_
        const files = await filterFiles(input)
        return files.map(v => ({ title: v }))
      },
    }, {
      onCancel(_prompt, _answers) {
        cancelled = true
      },
    })
    latestFilename = input
    on()
    if (!cancelled) {
      const files = multiple ? await filterFiles(input) : [result.filter]
      await ctx.rerunFiles(files)
    }
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
