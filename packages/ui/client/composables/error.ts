import type Convert from 'ansi-to-html'
import type { RunnerTask, TestError } from 'vitest'
import { parseStacktrace } from '@vitest/utils/source-map'
import Filter from 'ansi-to-html'
import { escapeHtml } from '~/utils/escape'

declare module '@vitest/runner' {
  interface TaskResult {
    htmlError?: string
  }
}

export function isTestFile(name: string, fileName?: string) {
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
  let error = e as TestError

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

  error.stacks = parseStacktrace(error.stack || '', {
    ignoreStackEntries: [],
  })

  return error
}

function createHtmlError(filter: Convert, error: TestError) {
  let htmlError = ''
  if (error.message?.includes('\x1B')) {
    htmlError = `<b>${error.name}</b>: ${filter.toHtml(
      escapeHtml(error.message),
    )}`
  }

  const startStrWithX1B = error.stack?.includes('\x1B')
  if (startStrWithX1B) {
    if (htmlError.length > 0) {
      htmlError += filter.toHtml(
        escapeHtml((error.stack) as string),
      )
    }
    else {
      htmlError = `<b>${error.name}</b>: ${
        error.message
      }${filter.toHtml(
        escapeHtml((error.stack) as string),
      )}`
    }
  }

  if (htmlError.length > 0) {
    return htmlError
  }
  return null
}

export function mapLeveledTaskStacks(dark: boolean, tasks: RunnerTask[]) {
  const filter = createAnsiToHtmlFilter(dark)
  return tasks.map((t) => {
    const result = t.result
    if (!result || result.htmlError) {
      return t
    }
    const errors = result.errors
      ?.map(error => createHtmlError(filter, error))
      .filter(error => error != null)
      .join('<br><br>')
    if (errors?.length) {
      result.htmlError = errors
    }
    return t
  })
}
