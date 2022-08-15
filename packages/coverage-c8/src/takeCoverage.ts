import v8 from 'v8'

// Flush coverage to disk

export function takeCoverage() {
  if (v8.takeCoverage == null)
    console.warn('[Vitest] takeCoverage is not available in this NodeJs version.\nCoverage could be incomplete. Update to NodeJs 14.18.')
  else
    v8.takeCoverage()
}
