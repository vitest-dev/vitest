import * as diff from 'diff'

export interface DiffOptions {
  outputTruncateLength?: number
  outputDiffLines?: number
  showLegend?: boolean
}

function formatLine(line: string, maxWidth: number) {
  return line.slice(0, maxWidth) + (line.length > maxWidth ? '…' : '')
}

export function unifiedDiff(actual: string, expected: string, options: DiffOptions = {}) {
  if (actual === expected)
    return ''

  const { outputTruncateLength = 80, outputDiffLines, showLegend = true } = options

  const indent = '  '
  const diffLimit = outputDiffLines || 15

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
        return `${char} ...`
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
        return line
      return `- ${formatLine(line, outputTruncateLength)}`
    }
    if (line[0] === '+') {
      line = formatLine(line.slice(1), outputTruncateLength)
      if (isCompact)
        return line
      return `+ ${formatLine(line, outputTruncateLength)}`
    }
    if (line.match(/@@/))
      return '--'
    return ` ${line}`
  })

  if (showLegend) {
    // Compact mode
    if (isCompact) {
      formatted = [
        `- Expected   ${formatted[0]}`,
        `+ Received   ${formatted[1]}`,
      ]
    }
    else {
      if (formatted[0].includes('"'))
        formatted[0] = formatted[0].replace('"', '')

      const last = formatted.length - 1
      if (formatted[last].endsWith('"'))
        formatted[last] = formatted[last].slice(0, formatted[last].length - 1)

      formatted.unshift(
        `- Expected  - ${counts['-']}`,
        `+ Received  + ${counts['+']}`,
        '',
      )
    }
  }

  return formatted.map(i => indent + i).join('\n')
}
