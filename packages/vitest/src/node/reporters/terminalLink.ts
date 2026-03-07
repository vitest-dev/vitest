import { pathToFileURL } from 'node:url'

export interface TerminalLinkOptions {
  isTTY: boolean
  isCI: boolean
}

export function createTerminalLink(text: string, file: string, options: TerminalLinkOptions): string {
  // Graceful fallback for non-TTY or CI
  if (!options.isTTY || options.isCI) {
    return text
  }

  // Ensure file exists and is valid before creating URL
  if (!file || file.startsWith('node:')) {
    return text
  }

  try {
    const href = pathToFileURL(file).href
    // OSC 8 escape sequence
    return `\u001B]8;;${href}\u001B\\${text}\u001B]8;;\u001B\\`
  }
  catch {
    return text
  }
}
