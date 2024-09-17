type Pattern = string
type PatternTypeOptions = any

// copy of fast-glob's isDynamicPattern until it's implemented on tinyglobby
// https://github.com/SuperchupuDev/tinyglobby/issues/28
// https://github.com/mrmlnc/fast-glob/blob/da648078ae87bce81fcd42e64d5b2b1360c47b09/src/utils/pattern.ts#L35

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
