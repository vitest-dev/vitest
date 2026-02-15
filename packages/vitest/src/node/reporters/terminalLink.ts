import { pathToFileURL } from 'node:url'

export function createTerminalLink(text: string, file: string): string {
  // Graceful fallback for non-TTY or CI
  // Also check VITEST_FORCE_TTY to allow explicit disabling
  if (!process.stdout?.isTTY || process.env.CI || process.env.VITEST_FORCE_TTY === 'false') {
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
