import Filter from 'ansi-to-html'

export function shouldOpenInEditor(name: string, fileName?: string) {
  return fileName && name.endsWith(fileName)
}

export async function openInEditor(name: string, line: number, column: number) {
  const url = encodeURI(`${name}:${line}:${column}`)
  await fetch(`/__open-in-editor?file=${url}`)
}

export function createAnsiToHtmlFilter(dark: boolean) {
  return new Filter({
    fg: dark ? '#000' : '#FFF',
    bg: dark ? '#FFF' : '#000',
  })
}
