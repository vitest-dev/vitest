import type { TokenColors } from 'tinyhighlight'
import type { Colors } from 'tinyrainbow'
import { extname } from 'pathe'
import { highlight } from 'tinyhighlight'
import c from 'tinyrainbow'

const HIGHLIGHT_SUPPORTED_EXTS = new Set(
  ['js', 'ts'].flatMap(lang => [
    `.${lang}`,
    `.m${lang}`,
    `.c${lang}`,
    `.${lang}x`,
    `.m${lang}x`,
    `.c${lang}x`,
  ]),
)

export function highlightCode(id: string, source: string): string {
  const ext = extname(id)
  if (!HIGHLIGHT_SUPPORTED_EXTS.has(ext)) {
    return source
  }
  const isJsx = ext.endsWith('x')
  return highlight(source, { jsx: isJsx, colors: getDefs(c) })
}

function getDefs(c: Colors): TokenColors {
  const Invalid = (text: string) => c.white(c.bgRed(c.bold(text)))
  return {
    Keyword: c.magenta,
    IdentifierCapitalized: c.yellow,
    Punctuator: c.yellow,
    StringLiteral: c.green,
    NoSubstitutionTemplate: c.green,
    MultiLineComment: c.gray,
    SingleLineComment: c.gray,
    RegularExpressionLiteral: c.cyan,
    NumericLiteral: c.blue,
    TemplateHead: text =>
      c.green(text.slice(0, text.length - 2)) + c.cyan(text.slice(-2)),
    TemplateTail: text => c.cyan(text.slice(0, 1)) + c.green(text.slice(1)),
    TemplateMiddle: text =>
      c.cyan(text.slice(0, 1))
      + c.green(text.slice(1, text.length - 2))
      + c.cyan(text.slice(-2)),
    IdentifierCallable: c.blue,
    PrivateIdentifierCallable: text => `#${c.blue(text.slice(1))}`,
    Invalid,

    JSXString: c.green,
    JSXIdentifier: c.yellow,
    JSXInvalid: Invalid,
    JSXPunctuator: c.yellow,
  }
}
