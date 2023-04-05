import { getColors } from './colors'
import { diffDescriptors, getConcordanceTheme } from './descriptors'

export * from './descriptors'

export interface DiffOptions {
  showLegend?: boolean
  outputDiffLines?: number
}

/**
* Returns unified diff between two strings with coloured ANSI output.
*
* @private
* @param {String} actual
* @param {String} expected
* @return {string} The diff.
*/
export function unifiedDiff(actual: unknown, expected: unknown, options: DiffOptions = {}) {
  const theme = getConcordanceTheme()
  const diff = diffDescriptors(actual, expected, { theme })

  const { showLegend = true, outputDiffLines = 15 } = options

  const counts = {
    '+': 0,
    '-': 0,
  }
  const c = getColors()
  const plus = theme.diffGutters.actual
  const minus = `  ${c.green('+')}`

  const lines = diff.split(/\r?\n/g)
  let firstErrorLine: number | null = null
  lines.forEach((line, index) => {
    if (line.startsWith(plus)) {
      firstErrorLine ??= index
      counts['+']++
    }
    else if (line.startsWith(minus)) {
      firstErrorLine ??= index
      counts['-']++
    }
  })
  const isCompact = counts['+'] === 1 && counts['-'] === 1 && lines.length === 2

  let legend = ''

  if (showLegend) {
    if (!isCompact) {
      legend = `  ${c.green(`- Expected  - ${counts['-']}`)}
  ${c.red(`+ Received  + ${counts['+']}`)}

`
    }
    else {
      legend = '  Difference:\n\n'
    }
  }

  if (firstErrorLine != null && outputDiffLines) {
    const start = Math.max(0, firstErrorLine - 1)
    const end = Math.min(lines.length, firstErrorLine + outputDiffLines)
    const linesAfterCount = lines.length - end

    const linesBefore = start ? `  ${c.gray(`... ${start} more line${start > 1 ? 's' : ''}\n`)}` : ''
    const linesAfter = linesAfterCount ? `\n  ${c.gray(`... ${linesAfterCount} more line${linesAfterCount > 1 ? 's' : ''}\n`)}` : ''
    const diffOutput = lines.slice(start, end).map(line => line.replace(/␊\s*$/, '')).join('\n')
    const helperBunner = (linesAfter && (counts['+'] + counts['-'] > outputDiffLines)) ? `\n  Use ${c.gray('test.outputDiffLines')} to increase the number of lines shown.` : ''

    return legend + linesBefore + diffOutput + linesAfter + helperBunner
  }

  return legend + diff
}
