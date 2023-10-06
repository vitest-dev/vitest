export function createIndexMap(source: string) {
  const map = new Map<string, number>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(`${line}:${column}`, index++)
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}
