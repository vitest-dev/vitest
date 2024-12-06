type Pattern = string
type PatternTypeOptions = any

// copy of fast-glob's isDynamicPattern until it's implemented on tinyglobby
// https://github.com/SuperchupuDev/tinyglobby/issues/28
// https://github.com/mrmlnc/fast-glob/blob/da648078ae87bce81fcd42e64d5b2b1360c47b09/src/utils/pattern.ts#L35

/*
MIT License

Copyright (c) Denis Malinochkin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const ESCAPE_SYMBOL = '\\'

const COMMON_GLOB_SYMBOLS_RE = /[*?]|^!/
const REGEX_CHARACTER_CLASS_SYMBOLS_RE = /\[[^[]*\]/
const REGEX_GROUP_SYMBOLS_RE = /(?:^|[^!*+?@])\([^(]*\|[^|]*\)/
const GLOB_EXTENSION_SYMBOLS_RE = /[!*+?@]\([^(]*\)/
const BRACE_EXPANSION_SEPARATORS_RE = /,|\.\./

export function isDynamicPattern(pattern: Pattern, options: PatternTypeOptions = {}): boolean {
  /**
   * A special case with an empty string is necessary for matching patterns that start with a forward slash.
   * An empty string cannot be a dynamic pattern.
   * For example, the pattern `/lib/*` will be spread into parts: '', 'lib', '*'.
   */
  if (pattern === '') {
    return false
  }

  /**
   * When the `caseSensitiveMatch` option is disabled, all patterns must be marked as dynamic, because we cannot check
   * filepath directly (without read directory).
   */
  if (options.caseSensitiveMatch === false || pattern.includes(ESCAPE_SYMBOL)) {
    return true
  }

  if (COMMON_GLOB_SYMBOLS_RE.test(pattern) || REGEX_CHARACTER_CLASS_SYMBOLS_RE.test(pattern) || REGEX_GROUP_SYMBOLS_RE.test(pattern)) {
    return true
  }

  if (options.extglob !== false && GLOB_EXTENSION_SYMBOLS_RE.test(pattern)) {
    return true
  }

  if (options.braceExpansion !== false && hasBraceExpansion(pattern)) {
    return true
  }

  return false
}

function hasBraceExpansion(pattern: string): boolean {
  const openingBraceIndex = pattern.indexOf('{')

  if (openingBraceIndex === -1) {
    return false
  }

  const closingBraceIndex = pattern.indexOf('}', openingBraceIndex + 1)

  if (closingBraceIndex === -1) {
    return false
  }

  const braceContent = pattern.slice(openingBraceIndex, closingBraceIndex)

  return BRACE_EXPANSION_SEPARATORS_RE.test(braceContent)
}
