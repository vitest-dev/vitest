import readline from 'node:readline'
import c from 'picocolors'
import stripAnsi from 'strip-ansi'
import { createDefer } from '@vitest/utils'
import { stdout } from '../utils'

const MAX_RESULT_COUNT = 10
const SELECTION_MAX_INDEX = 7
const ESC = '\u001B['

type FilterFunc = (keyword: string) => Promise<string[]> | string[]

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
    stdout().write(this.promptLine())

    const resultPromise = createDefer<string | undefined>()

    this.onKeyPress = this.filterHandler(filterFunc, (result) => {
      resultPromise.resolve(result)
    })
    process.stdin.on('keypress', this.onKeyPress)
    try {
      return await resultPromise
    }
    finally {
      this.close()
    }
  }

  private filterHandler(filterFunc: FilterFunc, onSubmit: (result?: string) => void) {
    return async (str: string | undefined, key: any) => {
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
            this.currentKeyword += str || ''
          break
      }

      if (this.currentKeyword)
        this.results = await filterFunc(this.currentKeyword)

      this.render()
    }
  }

  private render() {
    let printStr = this.promptLine()
    if (!this.currentKeyword) {
      printStr += '\nPlease input filter pattern'
    }
    else if (this.currentKeyword && this.results.length === 0) {
      printStr += '\nPattern matches no results'
    }
    else {
      const resultCountLine = this.results.length === 1 ? `Pattern matches ${this.results.length} result` : `Pattern matches ${this.results.length} results`

      let resultBody = ''

      if (this.results.length > MAX_RESULT_COUNT) {
        const offset = this.selectionIndex > SELECTION_MAX_INDEX ? this.selectionIndex - SELECTION_MAX_INDEX : 0
        const displayResults = this.results.slice(offset, MAX_RESULT_COUNT + offset)
        const remainingResultCount = this.results.length - offset - displayResults.length

        resultBody = `${displayResults.map((result, index) => (index + offset === this.selectionIndex) ? c.green(` › ${result}`) : c.dim(` › ${result}`)).join('\n')}`
        if (remainingResultCount > 0)
          resultBody += '\n' + `${c.dim(`   ...and ${remainingResultCount} more ${remainingResultCount === 1 ? 'result' : 'results'}`)}`
      }
      else {
        resultBody = this.results.map((result, index) => (index === this.selectionIndex) ? c.green(` › ${result}`) : c.dim(` › ${result}`))
          .join('\n')
      }

      printStr += `\n${resultCountLine}\n${resultBody}`
    }
    this.eraseAndPrint(printStr)
    this.restoreCursor()
  }

  private keywordOffset() {
    return `? ${this.message} › `.length + 1
  }

  private promptLine() {
    return `${c.cyan('?')} ${c.bold(this.message)} › ${this.currentKeyword || ''}`
  }

  private eraseAndPrint(str: string) {
    let rows = 0
    const lines = str.split(/\r?\n/)
    for (const line of lines)
      // We have to take care of screen width in case of long lines
      rows += 1 + Math.floor(Math.max(stripAnsi(line).length - 1, 0) / stdout().columns)

    stdout().write(`${ESC}1G`) // move to the beginning of the line
    stdout().write(`${ESC}J`) // erase down
    stdout().write(str)
    stdout().write(`${ESC}${rows - 1}A`) // moving up lines
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
