export function trimReporterOutput(report: string) {
  const rows = report.replace(/\d+ms/g, '[...]ms').split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Test Files')))

  return rows.join('\n').trim()
}
