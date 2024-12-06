import type { ErrorWithDiff } from 'vitest'
import { parseStacktrace } from '@vitest/utils/source-map'
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
    fg: dark ? '#FFF' : '#000',
    bg: dark ? '#000' : '#FFF',
  })
}

function isPrimitive(value: unknown) {
  return (
    value === null || (typeof value !== 'function' && typeof value !== 'object')
  )
}

export function parseError(e: unknown) {
  let error = e as ErrorWithDiff

  if (isPrimitive(e)) {
    error = {
      message: String(error).split(/\n/g)[0],
      stack: String(error),
      name: '',
    }
  }

  if (!e) {
    const err = new Error('unknown error')
    error = {
      message: err.message,
      stack: err.stack,
      name: '',
    }
  }

  error.stacks = parseStacktrace(error.stack || error.stackStr || '', {
    ignoreStackEntries: [],
  })

  return error
}
