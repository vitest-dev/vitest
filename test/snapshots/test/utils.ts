export function extractInlineSnaphsots(code: string) {
  const matches = Array.from(
    code.matchAll(/\.toMatch(\w+)InlineSnapshot\(\s*`[\s\S]*?`\s*\)/g),
  )
  const snapshots = matches.map((match) => {
    const end = match.index! + match[0].length
    const start = code.lastIndexOf('expect', match.index)
    if (start === -1) {
      throw new Error(`Failed to extract inline snapshot: no expect found for match ${match[0]}`)
    }
    return code.slice(start, end)
  })
  return `\n${snapshots.join('\n\n')}\n`
}
