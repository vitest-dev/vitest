import c from 'picocolors'
import * as diff from 'diff'
import cliTruncate from 'cli-truncate'

export function formatLine(line: string, outputTruncateLength?: number) {
  return cliTruncate(line, (outputTruncateLength ?? (process.stdout?.columns || 80)) - 4)
}

export interface DiffOptions {
  outputTruncateLength?: number
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

  const { outputTruncateLength, showLegend = true } = options

  const indent = '  '
  const diffLimit = 15

  const counts = {
    '+': 0,
    '-': 0,
  }
  let previousState: '-' | '+' | null = null
  let previousCount = 0
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
        return c.dim(`${char} ...`)
      else if (previousCount > diffLimit)
        return
    }
    return line
  }

  const msg = diff.createPatch('string', expected, actual)
  const lines = msg.split('\n').slice(5).map(preprocess).filter(Boolean) as string[]
  const isCompact = counts['+'] === 1 && counts['-'] === 1 && lines.length === 2

  let formatted = lines.map((line: string) => {
    line = line.replace(/\\"/g, '"')
    if (line[0] === '-') {
      line = formatLine(line.slice(1), outputTruncateLength)
      if (isCompact)
        return c.green(line)
      return c.green(`- ${formatLine(line, outputTruncateLength)}`)
    }
    if (line[0] === '+') {
      line = formatLine(line.slice(1), outputTruncateLength)
      if (isCompact)
        return c.red(line)
      return c.red(`+ ${formatLine(line, outputTruncateLength)}`)
    }
    if (line.match(/@@/))
      return '--'
    return ` ${line}`
  })

  if (showLegend) {
    // Compact mode
    if (isCompact) {
      formatted = [
        `${c.green('- Expected')}   ${formatted[0]}`,
        `${c.red('+ Received')}   ${formatted[1]}`,
      ]
    }
    else {
      if (formatted[0].includes('"'))
        formatted[0] = formatted[0].replace('"', '')

      const last = formatted.length - 1
      if (formatted[last].endsWith('"'))
        formatted[last] = formatted[last].slice(0, formatted[last].length - 1)

      formatted.unshift(
        c.green(`- Expected  - ${counts['-']}`),
        c.red(`+ Received  + ${counts['+']}`),
        '',
      )
    }
  }

  return formatted.map(i => indent + i).join('\n')
}
