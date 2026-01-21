import type { TestTagDefinition, VitestRunnerConfig } from '../types/runner'

export function validateTags(config: VitestRunnerConfig, tags: string[]): void {
  if (!config.strictTags) {
    return
  }

  const availableTags = new Set(config.tags.map(tag => tag.name))
  for (const tag of tags) {
    if (!availableTags.has(tag)) {
      throw createNoTagsError(config.tags, tag)
    }
  }
}

export function createNoTagsError(availableTags: TestTagDefinition[], tag: string, prefix = 'tag'): never {
  if (!availableTags.length) {
    throw new Error(`The Vitest config does't define any "tags", cannot apply "${tag}" ${prefix} for this test. See: https://vitest.dev/guide/test-tags`)
  }
  throw new Error(`The ${prefix} "${tag}" is not defined in the configuration. Available tags are:\n${availableTags
    .map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n')}`)
}

export function createTagsFilter(tagsExpr: string[], availableTags: TestTagDefinition[]): (testTags: string[]) => boolean {
  const matchers = tagsExpr.map(expr => parseTagsExpression(expr, availableTags))
  return (testTags: string[]) => {
    return matchers.every(matcher => matcher(testTags))
  }
}

type TagMatcher = (tags: string[]) => boolean

function parseTagsExpression(expr: string, availableTags: TestTagDefinition[]): TagMatcher {
  const tokens = tokenize(expr)
  const stream = new TokenStream(tokens, expr)
  const ast = parseOrExpression(stream, availableTags)
  if (stream.peek().type !== 'EOF') {
    throw new Error(`Invalid tags expression: unexpected "${formatToken(stream.peek())}" in "${expr}"`)
  }
  return (tags: string[]) => evaluateNode(ast, tags)
}

function formatToken(token: Token): string {
  switch (token.type) {
    case 'TAG': return token.value
    default: return formatTokenType(token.type)
  }
}

type Token
  = | { type: 'TAG'; value: string }
    | { type: 'AND' }
    | { type: 'OR' }
    | { type: 'NOT' }
    | { type: 'LPAREN' }
    | { type: 'RPAREN' }
    | { type: 'EOF' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    if (expr[i] === ' ' || expr[i] === '\t') {
      i++
      continue
    }

    if (expr[i] === '(') {
      tokens.push({ type: 'LPAREN' })
      i++
      continue
    }

    if (expr[i] === ')') {
      tokens.push({ type: 'RPAREN' })
      i++
      continue
    }

    if (expr[i] === '!') {
      tokens.push({ type: 'NOT' })
      i++
      continue
    }

    if (expr.slice(i, i + 2) === '&&') {
      tokens.push({ type: 'AND' })
      i += 2
      continue
    }

    if (expr.slice(i, i + 2) === '||') {
      tokens.push({ type: 'OR' })
      i += 2
      continue
    }

    if (/^and(?:\s|\)|$)/i.test(expr.slice(i))) {
      tokens.push({ type: 'AND' })
      i += 3
      continue
    }

    if (/^or(?:\s|\)|$)/i.test(expr.slice(i))) {
      tokens.push({ type: 'OR' })
      i += 2
      continue
    }

    if (/^not\s/i.test(expr.slice(i))) {
      tokens.push({ type: 'NOT' })
      i += 3
      continue
    }

    let tag = ''
    while (i < expr.length && expr[i] !== ' ' && expr[i] !== '\t' && expr[i] !== '(' && expr[i] !== ')' && expr[i] !== '!' && expr[i] !== '&' && expr[i] !== '|') {
      const remaining = expr.slice(i)
      // Only treat and/or/not as operators if we're at the start of a tag (after whitespace)
      // This allows tags like "demand", "editor", "cannot" to work correctly
      if (tag === '' && (/^and(?:\s|\)|$)/i.test(remaining) || /^or(?:\s|\)|$)/i.test(remaining) || /^not\s/i.test(remaining))) {
        break
      }
      tag += expr[i]
      i++
    }

    if (tag) {
      tokens.push({ type: 'TAG', value: tag })
    }
  }

  tokens.push({ type: 'EOF' })
  return tokens
}

type ASTNode
  = | { type: 'tag'; value: string; pattern: RegExp | null }
    | { type: 'not'; operand: ASTNode }
    | { type: 'and'; left: ASTNode; right: ASTNode }
    | { type: 'or'; left: ASTNode; right: ASTNode }

class TokenStream {
  private pos = 0
  constructor(private tokens: Token[], public expr: string) {}

  peek(): Token {
    return this.tokens[this.pos]
  }

  next(): Token {
    return this.tokens[this.pos++]
  }

  expect(type: Token['type']): Token {
    const token = this.next()
    if (token.type !== type) {
      if (type === 'RPAREN' && token.type === 'EOF') {
        throw new Error(`Invalid tags expression: missing closing ")" in "${this.expr}"`)
      }
      throw new Error(`Invalid tags expression: expected "${formatTokenType(type)}" but got "${formatToken(token)}" in "${this.expr}"`)
    }
    return token
  }

  unexpectedToken(): never {
    const token = this.peek()
    if (token.type === 'EOF') {
      throw new Error(`Invalid tags expression: unexpected end of expression in "${this.expr}"`)
    }
    throw new Error(`Invalid tags expression: unexpected "${formatToken(token)}" in "${this.expr}"`)
  }
}

function formatTokenType(type: Token['type']): string {
  switch (type) {
    case 'TAG': return 'tag'
    case 'AND': return 'and'
    case 'OR': return 'or'
    case 'NOT': return 'not'
    case 'LPAREN': return '('
    case 'RPAREN': return ')'
    case 'EOF': return 'end of expression'
  }
}

function parseOrExpression(stream: TokenStream, availableTags: TestTagDefinition[]): ASTNode {
  let left = parseAndExpression(stream, availableTags)

  while (stream.peek().type === 'OR') {
    stream.next()
    const right = parseAndExpression(stream, availableTags)
    left = { type: 'or', left, right }
  }

  return left
}

function parseAndExpression(stream: TokenStream, availableTags: TestTagDefinition[]): ASTNode {
  let left = parseUnaryExpression(stream, availableTags)

  while (stream.peek().type === 'AND') {
    stream.next()
    const right = parseUnaryExpression(stream, availableTags)
    left = { type: 'and', left, right }
  }

  return left
}

function parseUnaryExpression(stream: TokenStream, availableTags: TestTagDefinition[]): ASTNode {
  if (stream.peek().type === 'NOT') {
    stream.next()
    const operand = parseUnaryExpression(stream, availableTags)
    return { type: 'not', operand }
  }

  return parsePrimaryExpression(stream, availableTags)
}

function parsePrimaryExpression(stream: TokenStream, availableTags: TestTagDefinition[]): ASTNode {
  const token = stream.peek()

  if (token.type === 'LPAREN') {
    stream.next()
    const expr = parseOrExpression(stream, availableTags)
    stream.expect('RPAREN')
    return expr
  }

  if (token.type === 'TAG') {
    stream.next()
    const tagValue = token.value
    const pattern = resolveTagPattern(tagValue, availableTags)
    return { type: 'tag', value: tagValue, pattern }
  }

  stream.unexpectedToken()
}

function createWildcardRegex(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
}

function resolveTagPattern(tagPattern: string, availableTags: TestTagDefinition[]): RegExp | null {
  if (tagPattern.includes('*')) {
    const regex = createWildcardRegex(tagPattern)
    const hasMatch = availableTags.some(tag => regex.test(tag.name))
    if (!hasMatch) {
      throw createNoTagsError(availableTags, tagPattern, 'tag pattern')
    }
    return regex
  }

  if (!availableTags.length || !availableTags.some(tag => tag.name === tagPattern)) {
    throw createNoTagsError(availableTags, tagPattern, 'tag pattern')
  }
  return null
}

function evaluateNode(node: ASTNode, tags: string[]): boolean {
  switch (node.type) {
    case 'tag':
      if (node.pattern) {
        return tags.some(tag => node.pattern!.test(tag))
      }
      return tags.includes(node.value)
    case 'not':
      return !evaluateNode(node.operand, tags)
    case 'and':
      return evaluateNode(node.left, tags) && evaluateNode(node.right, tags)
    case 'or':
      return evaluateNode(node.left, tags) || evaluateNode(node.right, tags)
  }
}
