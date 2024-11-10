import { groupBy } from '../../utils/base'
import { RangeLocationFilterProvidedError } from '../errors'

export function parseFilter(filter: string): Filter {
  const colonIndex = filter.indexOf(':')
  if (colonIndex === -1) {
    return { filename: filter }
  }

  const [parsedFilename, lineNumber] = [
    filter.substring(0, colonIndex),
    filter.substring(colonIndex + 1),
  ]

  if (lineNumber.match(/^\d+$/)) {
    return {
      filename: parsedFilename,
      lineNumber: Number.parseInt(lineNumber),
    }
  }
  else if (lineNumber.includes('-')) {
    throw new RangeLocationFilterProvidedError(filter)
  }
  else {
    return { filename: filter }
  }
}

interface Filter {
  filename: string
  lineNumber?: undefined | number
}

export function groupFilters(filters: Filter[]) {
  const groupedFilters_ = groupBy(filters, f => f.filename)
  const groupedFilters = Object.fromEntries(Object.entries(groupedFilters_)
    .map((entry) => {
      const [filename, filters] = entry
      const testLocations = filters.map(f => f.lineNumber)

      return [
        filename,
        testLocations.filter(l => l !== undefined) as number[],
      ]
    }),
  )

  return groupedFilters
}
