export function shouldOpenInEditor(name: string, fileName?: string) {
  return fileName && name.endsWith(fileName)
}

export async function openInEditor(name: string, line: number, column: number) {
  const url = encodeURI(`${name}:${line}:${column}`)
  await fetch(`/__open-in-editor?file=${url}`)
}

/*
export function buildCodeError() {
  const pos = stacks[0].sourcePos || stacks[0]
  const el = document.createElement('pre')
  el.className = 'c-red-600 dark:c-red-400'
  el.textContent = `${' '.repeat(pos.column)}^ ${e?.nameStr}: ${e?.message}`
}
*/
