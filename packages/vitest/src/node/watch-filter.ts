import type { Writable } from 'node:stream'
import readline from 'node:readline'
import { stripVTControlCharacters } from 'node:util'
import { createDefer } from '@vitest/utils'
import c from 'tinyrainbow'
import { stdout as getStdout } from '../utils/base'

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
  private stdin: NodeJS.ReadStream
  private stdout: NodeJS.WriteStream | Writable

  constructor(
    message: string,
    stdin: NodeJS.ReadStream = process.stdin,
    stdout: NodeJS.WriteStream | Writable = getStdout(),
  ) {
    this.message = message
    this.stdin = stdin
    this.stdout = stdout

    this.filterRL = readline.createInterface({
      input: this.stdin,
      escapeCodeTimeout: 50,
    })
    readline.emitKeypressEvents(this.stdin, this.filterRL)
    if (this.stdin.isTTY) {
      this.stdin.setRawMode(true)
    }
  }

  public async filter(filterFunc: FilterFunc): Promise<string | undefined> {
    this.write(this.promptLine())

    const resultPromise = createDefer<string | undefined>()

    this.onKeyPress = this.filterHandler(filterFunc, (result) => {
      resultPromise.resolve(result)
    })
    this.stdin.on('keypress', this.onKeyPress)
    try {
      return await resultPromise
    }
    finally {
      this.close()
    }
  }

  private filterHandler(
    filterFunc: FilterFunc,
    onSubmit: (result?: string) => void,
  ) {
    return async (str: string | undefined, key: any) => {
      switch (true) {
        case key.sequence === '\x7F':
          if (this.currentKeyword && this.currentKeyword?.length > 1) {
            this.currentKeyword = this.currentKeyword?.slice(0, -1)
          }
          else {
            this.currentKeyword = undefined
          }

          break
        case key?.ctrl && key?.name === 'c':
        case key?.name === 'escape':
          this.write(`${ESC}1G${ESC}0J`) // clean content
          onSubmit(undefined)
          return
        case key?.name === 'enter':
        case key?.name === 'return':
          onSubmit(
            this.results[this.selectionIndex] || this.currentKeyword || '',
          )
          this.currentKeyword = undefined
          break
        case key?.name === 'up':
          if (this.selectionIndex && this.selectionIndex > 0) {
            this.selectionIndex--
          }
          else {
            this.selectionIndex = -1
          }

          break
        case key?.name === 'down':
          if (this.selectionIndex < this.results.length - 1) {
            this.selectionIndex++
          }
          else if (this.selectionIndex >= this.results.length - 1) {
            this.selectionIndex = this.results.length - 1
          }

          break
        case !key?.ctrl && !key?.meta:
          if (this.currentKeyword === undefined) {
            this.currentKeyword = str
          }
          else {
            this.currentKeyword += str || ''
          }
          break
      }

      if (this.currentKeyword) {
        this.results = await filterFunc(this.currentKeyword)
      }

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
      const resultCountLine
        = this.results.length === 1
          ? `Pattern matches ${this.results.length} result`
          : `Pattern matches ${this.results.length} results`

      let resultBody = ''

      if (this.results.length > MAX_RESULT_COUNT) {
        const offset
          = this.selectionIndex > SELECTION_MAX_INDEX
            ? this.selectionIndex - SELECTION_MAX_INDEX
            : 0
        const displayResults = this.results.slice(
          offset,
          MAX_RESULT_COUNT + offset,
        )
        const remainingResultCount
          = this.results.length - offset - displayResults.length

        resultBody = `${displayResults
          .map((result, index) =>
            index + offset === this.selectionIndex
              ? c.green(` › ${result}`)
              : c.dim(` › ${result}`),
          )
          .join('\n')}`
        if (remainingResultCount > 0) {
          resultBody
            += '\n'
              + `${c.dim(
                `   ...and ${remainingResultCount} more ${
                  remainingResultCount === 1 ? 'result' : 'results'
                }`,
              )}`
        }
      }
      else {
        resultBody = this.results
          .map((result, index) =>
            index === this.selectionIndex
              ? c.green(` › ${result}`)
              : c.dim(` › ${result}`),
          )
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
    return `${c.cyan('?')} ${c.bold(this.message)} › ${
      this.currentKeyword || ''
    }`
  }

  private eraseAndPrint(str: string) {
    let rows = 0
    const lines = str.split(/\r?\n/)
    for (const line of lines) {
      const columns = 'columns' in this.stdout ? this.stdout.columns : 80

      // We have to take care of screen width in case of long lines
      rows += 1 + Math.floor(Math.max(stripVTControlCharacters(line).length - 1, 0) / columns)
    }

    this.write(`${ESC}1G`) // move to the beginning of the line
    this.write(`${ESC}J`) // erase down
    this.write(str)
    this.write(`${ESC}${rows - 1}A`) // moving up lines
  }

  private close() {
    this.filterRL.close()
    if (this.onKeyPress) {
      this.stdin.removeListener('keypress', this.onKeyPress)
    }

    if (this.stdin.isTTY) {
      this.stdin.setRawMode(false)
    }
  }

  private restoreCursor() {
    const cursortPos
      = this.keywordOffset() + (this.currentKeyword?.length || 0)
    this.write(`${ESC}${cursortPos}G`)
  }

  private write(data: string) {
    // @ts-expect-error -- write() method has different signature on the union type
    this.stdout.write(data)
  }

  public getLastResults() {
    return this.results
  }
}
