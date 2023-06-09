import { getColors } from './colors'
import { diffDescriptors, getConcordanceTheme } from './descriptors'

export interface DiffOptions {
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
export function unifiedDiff(actual: unknown, expected: unknown, options: DiffOptions = {}) {
  const theme = getConcordanceTheme()
  const diff = diffDescriptors(actual, expected, { theme })

  const { showLegend = true } = options

  const counts = {
    '+': 0,
    '-': 0,
  }
  const c = getColors()
  const plus = theme.diffGutters.actual
  const minus = `  ${c.green('+')}`

  const lines = diff.split(/\r?\n/g)
  lines.forEach((line) => {
    if (line.startsWith(plus))
      counts['+']++
    else if (line.startsWith(minus))
      counts['-']++
  })

  if (counts['+'] === 0 && counts['-'] === 0)
    return ''

  let legend = ''

  if (showLegend) {
    legend = `  ${c.green(`- Expected  - ${counts['-']}`)}
  ${c.red(`+ Received  + ${counts['+']}`)}

`
  }

  return legend + diff.replace(/␊\s*$/mg, '')
}
