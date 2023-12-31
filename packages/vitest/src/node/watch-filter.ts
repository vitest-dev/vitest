import readline from 'node:readline'
import c from 'picocolors'
import prompt from 'prompts'
import { stdout } from '../utils'

type FilterFunc = (keyword: string) => Promise<string[]> // Define the FilterFunc type if not already defined
const MAX_RESULT_COUNT = 10

export class WatchFilter {
  private filterRL: readline.Interface
  private currentKeyword: string | undefined = undefined
  private message: string
  private results: string[] = []

  constructor(message: string) {
    this.message = message
    this.filterRL = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 })
    readline.emitKeypressEvents(process.stdin, this.filterRL)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false)
  }

  public async filter(initial: string, filterFunc: FilterFunc): Promise<string> {
    const handler = this.filterHandler(filterFunc)
    process.stdin.on('keypress', handler)

    const { filter = '' }: { filter: string } = await prompt([{
      name: 'filter',
      type: 'text',
      message: this.message,
      initial,
    }])

    this.filterRL.close()
    process.stdin.removeListener('keypress', handler)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false)

    return filter
  }

  private restoreCursor() {
    const cursortPos = `? ${this.message} › `.length + (this.currentKeyword?.length || 0)
    stdout().write(`\u001B[${cursortPos}G`)
  }

  private filterHandler(filterFunc: FilterFunc) {
    return async (str: string, key: any) => {
    // backspace
      if (key.sequence === '\x7F') {
        if (this.currentKeyword && this.currentKeyword?.length > 1)

          this.currentKeyword = this.currentKeyword?.slice(0, -1)

        else
          this.currentKeyword = undefined
      }
      else if (key?.name === 'return') {
        // reset current keyword
        this.currentKeyword = undefined
      }
      else {
        if (this.currentKeyword === undefined)
          this.currentKeyword = str
        else
          this.currentKeyword += str
      }

      if (this.currentKeyword)
        this.results = await filterFunc(this.currentKeyword)

      this.render()
    }
  }

  private render() {
    if (this.currentKeyword) {
      if (this.results.length === 0) {
        this.eraseAndPrint(`\nPattern matches no results`)
      }
      else {
        if (this.results.length > MAX_RESULT_COUNT) {
          this.eraseAndPrint(`\nPattern matches ${this.results.length} results`
           + `\n${this.results.slice(0, MAX_RESULT_COUNT).map(result => c.dim(` › ${result}`)).join('\n')}${
            c.dim(`\n   ...and ${this.results.length - MAX_RESULT_COUNT} more results`)}`)
        }
        else { this.eraseAndPrint(`\nPattern matches ${this.results.length} results` + `\n${this.results.map(result => c.dim(` › ${result}`)).join('\n')}`) }
      }
    }
    else {
      this.eraseAndPrint('\nPlease input filter pattern')
    }
    this.restoreCursor()
  }

  private eraseAndPrint(str: string) {
    const lineBreasks = str.split('\n').length - 1

    stdout().write('\u001B[J')
    stdout().write(str)
    stdout().write(`\u001B[${lineBreasks}A`)
  }
}
