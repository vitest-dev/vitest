import c from 'picocolors'
import * as diff from 'diff'
import cliTruncate from 'cli-truncate'

export function formatLine(line: string, outputTruncateLength?: number) {
  return cliTruncate(line, (outputTruncateLength ?? (process.stdout?.columns || 80)) - 4)
}

export interface DiffOptions {
  noColor?: boolean
  outputDiffMaxLines?: number
  outputTruncateLength?: number
  outputDiffLines?: number
  showLegend?: boolean
}

/**
* Returns unified diff between two strings with coloured ANSI output.
*
* @private
* @param {String} actual
* @param {String} expected
* @return {string} The diff.
*/

export function unifiedDiff(actual: string, expected: string, options: DiffOptions = {}) {
  if (actual === expected)
    return ''

  const { outputTruncateLength, outputDiffLines, outputDiffMaxLines, noColor, showLegend = true } = options

  const indent = '  '
  const diffLimit = outputDiffLines || 15
  const diffMaxLines = outputDiffMaxLines || 50

  const counts = {
    '+': 0,
    '-': 0,
  }
  let previousState: '-' | '+' | null = null
  let previousCount = 0

  const str = (str: string) => str
  const dim = noColor ? str : c.dim
  const green = noColor ? str : c.green
  const red = noColor ? str : c.red
  function preprocess(line: string) {
    if (!line || line.match(/\\ No newline/))
      return

    const char = line[0] as '+' | '-'
    if ('-+'.includes(char)) {
      if (previousState !== char) {
        previousState = char
        previousCount = 0
      }
      previousCount++
      counts[char]++
      if (previousCount === diffLimit)
        return dim(`${char} ...`)
      else if (previousCount > diffLimit)
        return
    }
    return line
  }

  const msg = diff.createPatch('string', expected, actual)
  let lines = msg.split('\n').slice(5).map(preprocess).filter(Boolean) as string[]
  let moreLines = 0
  const isCompact = counts['+'] === 1 && counts['-'] === 1 && lines.length === 2

  if (lines.length > diffMaxLines) {
    const firstDiff = lines.findIndex(line => line[0] === '-' || line[0] === '+')
    const displayLines = lines.slice(firstDiff - 2, diffMaxLines)
    const lastDisplayedIndex = firstDiff - 2 + diffMaxLines
    if (lastDisplayedIndex < lines.length)
      moreLines = lines.length - lastDisplayedIndex
    lines = displayLines
  }

  let formatted = lines.map((line: string) => {
    line = line.replace(/\\"/g, '"')
    if (line[0] === '-') {
      line = formatLine(line.slice(1), outputTruncateLength)
      if (isCompact)
        return green(line)
      return green(`- ${formatLine(line, outputTruncateLength)}`)
    }
    if (line[0] === '+') {
      line = formatLine(line.slice(1), outputTruncateLength)
      if (isCompact)
        return red(line)
      return red(`+ ${formatLine(line, outputTruncateLength)}`)
    }
    if (line.match(/@@/))
      return '--'
    return ` ${line}`
  })

  if (moreLines)
    formatted.push(dim(`... ${moreLines} more lines`))

  if (showLegend) {
    // Compact mode
    if (isCompact) {
      formatted = [
        `${green('- Expected')}   ${formatted[0]}`,
        `${red('+ Received')}   ${formatted[1]}`,
      ]
    }
    else {
      if (formatted[0].includes('"'))
        formatted[0] = formatted[0].replace('"', '')

      const last = formatted.length - 1
      if (formatted[last].endsWith('"'))
        formatted[last] = formatted[last].slice(0, formatted[last].length - 1)

      formatted.unshift(
        green(`- Expected  - ${counts['-']}`),
        red(`+ Received  + ${counts['+']}`),
        '',
      )
    }
  }

  return formatted.map(i => i ? (indent + i) : i).join('\n')
}
