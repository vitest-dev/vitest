import c from 'picocolors'
import * as diff from 'diff'
import cliTruncate from 'cli-truncate'

export function formatLine(line: string) {
  return cliTruncate(line, (process.stdout.columns || 80) - 4)
}

/**
* Returns unified diff between two strings with coloured ANSI output.
*
* @private
* @param {String} actual
* @param {String} expected
* @return {string} The diff.
*/

export function unifiedDiff(actual: string, expected: string) {
  if (actual === expected)
    return ''

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
    if (line[0] === '-') {
      line = formatLine(line.slice(1))
      if (isCompact)
        return c.green(line)
      return c.green(`- ${formatLine(line)}`)
    }
    if (line[0] === '+') {
      line = formatLine(line.slice(1))
      if (isCompact)
        return c.red(line)
      return c.red(`+ ${formatLine(line)}`)
    }
    if (line.match(/@@/))
      return '--'
    return ` ${line}`
  })

  // Compact mode
  if (isCompact) {
    formatted = [
      `${c.green('- Expected')}   ${formatted[0]}`,
      `${c.red('+ Received')}   ${formatted[1]}`,
    ]
  }
  else {
    formatted.unshift(
      c.green(`- Expected  - ${counts['-']}`),
      c.red(`+ Received  + ${counts['+']}`),
      '',
    )
  }

  return formatted.map(i => indent + i).join('\n')
}
