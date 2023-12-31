import readline from 'node:readline'
import c from 'picocolors'
import { stdout } from '../utils'

const MAX_RESULT_COUNT = 10
const SELECTION_MAX_INDEX = 7
const ESC = '\u001B['

type FilterFunc = (keyword: string) => Promise<string[]>

export class WatchFilter {
  private filterRL: readline.Interface
  private currentKeyword: string | undefined = undefined
  private message: string
  private results: string[] = []
  private selectionIndex = -1
  private onKeyPress?: (str: string, key: any) => void

  constructor(message: string) {
    this.message = message
    this.filterRL = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 })
    readline.emitKeypressEvents(process.stdin, this.filterRL)
    if (process.stdin.isTTY)
      process.stdin.setRawMode(true)
  }

  public async filter(filterFunc: FilterFunc): Promise<string | undefined> {
    stdout().write(`${c.cyan('?')} ${c.bold(this.message)} › `)
    return new Promise((resolve) => {
      this.onKeyPress = this.filterHandler(filterFunc, (result) => {
        this.close()
        resolve(result)
      })
      process.stdin.on('keypress', this.onKeyPress)
    })
  }

  private filterHandler(filterFunc: FilterFunc, onSubmit: (result?: string) => void) {
    return async (str: string, key: any) => {
      switch (true) {
        case key.sequence === '\x7F':
          if (this.currentKeyword && this.currentKeyword?.length > 1)
            this.currentKeyword = this.currentKeyword?.slice(0, -1)

          else
            this.currentKeyword = undefined

          break
        case key?.ctrl && key?.name === 'c':
        case key?.name === 'escape':
          this.cancel()
          onSubmit(undefined)
          break
        case key?.name === 'enter':
        case key?.name === 'return':
          onSubmit(this.results[this.selectionIndex] || this.currentKeyword || '')
          this.currentKeyword = undefined
          break
        case key?.name === 'up':
          if (this.selectionIndex && this.selectionIndex > 0)
            this.selectionIndex--
          else
            this.selectionIndex = -1

          break
        case key?.name === 'down':
          if (this.selectionIndex < this.results.length - 1)
            this.selectionIndex++
          else if (this.selectionIndex >= this.results.length - 1)
            this.selectionIndex = this.results.length - 1

          break
        case !key?.ctrl && !key?.meta:
          if (this.currentKeyword === undefined)
            this.currentKeyword = str

          else
            this.currentKeyword += str
          break
      }

      if (this.currentKeyword)
        this.results = await filterFunc(this.currentKeyword)

      this.render()
    }
  }

  private render() {
    this.printKeyword()
    if (!this.currentKeyword) {
      this.eraseAndPrint('\nPlease input filter pattern')
    }
    else if (this.currentKeyword && this.results.length === 0) {
      this.eraseAndPrint(`\nPattern matches no results`)
    }
    else {
      const resulCountLine = `Pattern matches ${this.results.length} results`

      let resultBody = ''

      if (this.results.length > MAX_RESULT_COUNT) {
        const offset = this.selectionIndex > SELECTION_MAX_INDEX ? this.selectionIndex - SELECTION_MAX_INDEX : 0
        const displayResults = this.results.slice(offset, MAX_RESULT_COUNT + offset)
        const remainingResultCount = this.results.length - offset - displayResults.length

        resultBody = `${displayResults.map((result, index) => (index + offset === this.selectionIndex) ? c.green(` › ${result}`) : c.dim(` › ${result}`)).join('\n')}`
        if (remainingResultCount > 0)
          resultBody += '\n' + `${c.dim(`   ...and ${remainingResultCount} more results`)}`
      }
      else {
        resultBody = this.results.map((result, index) => (index === this.selectionIndex) ? c.green(` › ${result}`) : c.dim(` › ${result}`))
          .join('\n')
      }

      this.eraseAndPrint(`\n${resulCountLine}\n${resultBody}`)
    }
    this.restoreCursor()
  }

  private keywordOffset() {
    return `? ${this.message} › `.length + 1
  }

  private printKeyword() {
    // move corsor to keyword offset
    stdout().write(`${ESC}${this.keywordOffset()}G`)

    // erase to the end of line
    stdout().write(`${ESC}K`)

    stdout().write(this.currentKeyword || '')
  }

  private eraseAndPrint(str: string) {
    const lineBreasks = str.split('\n').length - 1

    stdout().write(`${ESC}J`) // erase down
    stdout().write(str)
    stdout().write(`${ESC}${lineBreasks}A`) // moving up lines
  }

  private close() {
    this.filterRL.close()
    if (this.onKeyPress)
      process.stdin.removeListener('keypress', this.onKeyPress)

    if (process.stdin.isTTY)
      process.stdin.setRawMode(false)
  }

  private restoreCursor() {
    const cursortPos = this.keywordOffset() + (this.currentKeyword?.length || 0)
    stdout().write(`${ESC}${cursortPos}G`)
  }

  private cancel() {
    stdout().write(`${ESC}J`) // erase down
  }
}
