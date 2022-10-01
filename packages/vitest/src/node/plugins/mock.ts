import type { Plugin } from 'vite'
import MagicString from 'magic-string'
import { getCallLastIndex } from '../../utils'

const hoistRegexp = /^ *\b((?:vitest|vi)\s*.\s*(mock|unmock)\(["`'\s]+(.*[@\w_-]+)["`'\s]+)[),]{1};?/gm
const vitestRegexp = /import {[^}]*}.*(?=["'`]vitest["`']).*/gm

export function hoistMocks(code: string) {
  let m: MagicString | undefined
  const mocks = code.matchAll(hoistRegexp)

  for (const mockResult of mocks) {
    const lastIndex = getMockLastIndex(code.slice(mockResult.index!))

    if (lastIndex === null)
      continue

    const startIndex = mockResult.index!

    const { insideComment, insideString } = getIndexStatus(code, startIndex)

    if (insideComment || insideString)
      continue

    const endIndex = startIndex + lastIndex

    m ??= new MagicString(code)

    m.prepend(`${m.slice(startIndex, endIndex)}\n`)
    m.remove(startIndex, endIndex)
  }

  return m
}

const API_NOT_FOUND_ERROR = `There are some problems in resolving the mocks API.
You may encounter this issue when importing the mocks API from another module other than 'vitest'.

To fix this issue you can either:
- import the mocks API directly from 'vitest'
- enable the 'globals' options`

export const MocksPlugin = (): Plugin => {
  return {
    name: 'vitest:mock-plugin',
    enforce: 'post',
    async transform(code) {
      const m = hoistMocks(code)

      if (m) {
        // hoist vitest imports in case it was used inside vi.mock factory #425
        const vitestImports = code.matchAll(vitestRegexp)
        let found = false

        for (const match of vitestImports) {
          const indexStart = match.index!
          const indexEnd = match[0].length + indexStart
          m.remove(indexStart, indexEnd)
          m.prepend(`${match[0]}\n`)
          found = true
        }

        // if no vitest import found, check if the mock API is reachable after the hoisting
        if (!found) {
          m.prepend('try { vi } catch (_) { try { vitest } catch (__)'
           + `{ throw new Error(${JSON.stringify(API_NOT_FOUND_ERROR)}) } }\n`)
        }

        return {
          code: m.toString(),
          map: m.generateMap({ hires: true }),
        }
      }
    },
  }
}

function getMockLastIndex(code: string): number | null {
  const index = getCallLastIndex(code)
  if (index === null)
    return null
  return code[index + 1] === ';' ? index + 2 : index + 1
}

function getIndexStatus(code: string, from: number) {
  let index = 0
  let commentStarted = false
  let commentEnded = true
  let multilineCommentStarted = false
  let multilineCommentEnded = true
  let inString: string | null = null
  let beforeChar: string | null = null

  while (index <= from) {
    const char = code[index]
    const sub = code[index] + code[index + 1]

    if (!inString) {
      if (sub === '/*') {
        multilineCommentStarted = true
        multilineCommentEnded = false
      }
      if (sub === '*/' && multilineCommentStarted) {
        multilineCommentStarted = false
        multilineCommentEnded = true
      }
      if (sub === '//') {
        commentStarted = true
        commentEnded = false
      }
      if ((char === '\n' || sub === '\r\n') && commentStarted) {
        commentStarted = false
        commentEnded = true
      }
    }

    if (!multilineCommentStarted && !commentStarted) {
      const isCharString = char === '"' || char === '\'' || char === '`'

      if (isCharString && beforeChar !== '\\') {
        if (inString === char)
          inString = null
        else if (!inString)
          inString = char
      }
    }

    beforeChar = char
    index++
  }

  return {
    insideComment: !multilineCommentEnded || !commentEnded,
    insideString: inString !== null,
  }
}
