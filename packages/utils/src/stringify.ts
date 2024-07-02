import type { PrettyFormatOptions } from 'pretty-format'
import {
  format as prettyFormat,
  plugins as prettyFormatPlugins,
} from 'pretty-format'

const {
  AsymmetricMatcher,
  DOMCollection,
  DOMElement,
  Immutable,
  ReactElement,
  ReactTestComponent,
} = prettyFormatPlugins

const PLUGINS = [
  ReactTestComponent,
  ReactElement,
  DOMElement,
  DOMCollection,
  Immutable,
  AsymmetricMatcher,
]

export function stringify(
  object: unknown,
  maxDepth = 10,
  { maxLength, ...options }: PrettyFormatOptions & { maxLength?: number } = {},
): string {
  const MAX_LENGTH = maxLength ?? 10000
  let result

  try {
    result = prettyFormat(object, {
      maxDepth,
      escapeString: false,
      // min: true,
      plugins: PLUGINS,
      ...options,
    })
  }
  catch {
    result = prettyFormat(object, {
      callToJSON: false,
      maxDepth,
      escapeString: false,
      // min: true,
      plugins: PLUGINS,
      ...options,
    })
  }

  return result.length >= MAX_LENGTH && maxDepth > 1
    ? stringify(object, Math.floor(maxDepth / 2))
    : result
}
