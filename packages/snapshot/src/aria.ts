/**
 * Prototype ARIA snapshot pipeline.
 *
 * Simplified version of Playwright's aria snapshot:
 *   captureAriaTree  – walk DOM, build AriaNode tree
 *   renderAriaTree   – serialize tree to YAML-like text
 *   parseAriaTemplate – parse YAML-like template back into AriaTemplateNode tree
 *   matchAriaTree    – compare captured tree against template (contain semantics + regex names)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// adapter – DomainSnapshotAdapter wiring
// ---------------------------------------------------------------------------

import type { DomainMatchResult, DomainSnapshotAdapter } from './domain'

export interface AriaNode {
  role: string
  name: string
  children: (AriaNode | string)[]
  level?: number
  checked?: boolean | 'mixed'
  disabled?: boolean
  expanded?: boolean
  pressed?: boolean | 'mixed'
  selected?: boolean
}

export interface AriaTemplateRoleNode {
  kind: 'role'
  role: string
  name?: string | RegExp
  children?: AriaTemplateNode[]
  checked?: boolean | 'mixed'
  disabled?: boolean
  expanded?: boolean
  level?: number
  pressed?: boolean | 'mixed'
  selected?: boolean
}

export interface AriaTemplateTextNode {
  kind: 'text'
  text: string | RegExp
}

export type AriaTemplateNode = AriaTemplateRoleNode | AriaTemplateTextNode

// ---------------------------------------------------------------------------
// Implicit role mapping (subset, mirrors Playwright's kImplicitRoleByTagName)
// ---------------------------------------------------------------------------

const implicitRoles: Record<string, (el: Element) => string | null> = {
  A: el => el.hasAttribute('href') ? 'link' : null,
  ARTICLE: () => 'article',
  ASIDE: () => 'complementary',
  BUTTON: () => 'button',
  DIALOG: () => 'dialog',
  FIELDSET: () => 'group',
  FOOTER: () => 'contentinfo',
  FORM: () => 'form',
  H1: () => 'heading',
  H2: () => 'heading',
  H3: () => 'heading',
  H4: () => 'heading',
  H5: () => 'heading',
  H6: () => 'heading',
  HEADER: () => 'banner',
  HR: () => 'separator',
  IMG: el => (el.getAttribute('alt') === '' ? 'presentation' : 'img'),
  INPUT: (el) => {
    const type = (el as HTMLInputElement).type?.toLowerCase() || 'text'
    if (type === 'checkbox') {
      return 'checkbox'
    }
    if (type === 'radio') {
      return 'radio'
    }
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') {
      return 'button'
    }
    if (type === 'range') {
      return 'slider'
    }
    if (type === 'search') {
      return 'searchbox'
    }
    return 'textbox'
  },
  LI: () => 'listitem',
  MAIN: () => 'main',
  NAV: () => 'navigation',
  OL: () => 'list',
  OPTION: () => 'option',
  P: () => 'paragraph',
  PROGRESS: () => 'progressbar',
  SECTION: el => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') ? 'region' : null,
  SELECT: () => 'combobox',
  TABLE: () => 'table',
  TBODY: () => 'rowgroup',
  TD: () => 'cell',
  TEXTAREA: () => 'textbox',
  TFOOT: () => 'rowgroup',
  TH: () => 'columnheader',
  THEAD: () => 'rowgroup',
  TR: () => 'row',
  UL: () => 'list',
}

const headingLevels: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
}

// ---------------------------------------------------------------------------
// capture – DOM -> AriaNode tree
// ---------------------------------------------------------------------------

function getRole(el: Element): string | null {
  const explicit = el.getAttribute('role')
  if (explicit) {
    return explicit.split(' ')[0].trim() || null
  }
  return implicitRoles[el.tagName]?.(el) ?? null
}

function getAccessibleName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const doc = el.ownerDocument
    return labelledBy
      .split(/\s+/)
      .map(id => doc.getElementById(id)?.textContent?.trim() || '')
      .join(' ')
  }
  const label = el.getAttribute('aria-label')
  if (label) {
    return label
  }

  if (el.tagName === 'IMG') {
    return el.getAttribute('alt') || ''
  }
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    const id = el.getAttribute('id')
    if (id) {
      const labelEl = el.ownerDocument.querySelector(`label[for="${id}"]`)
      if (labelEl) {
        return labelEl.textContent?.trim() || ''
      }
    }
  }
  return ''
}

function isHidden(el: Element): boolean {
  if (el.getAttribute('aria-hidden') === 'true') {
    return true
  }
  if (el.hasAttribute('hidden')) {
    return true
  }
  if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) {
    return true
  }
  return false
}

function captureNode(node: Node): (AriaNode | string)[] {
  if (node.nodeType === 3 /* TEXT */) {
    const text = node.nodeValue?.replace(/\s+/g, ' ') || ''
    return text.trim() ? [text] : []
  }
  if (node.nodeType !== 1 /* ELEMENT */) {
    return []
  }

  const el = node as Element
  if (isHidden(el)) {
    return []
  }

  const role = getRole(el)
  const childResults: (AriaNode | string)[] = []
  for (let child = el.firstChild; child; child = child.nextSibling) {
    childResults.push(...captureNode(child))
  }

  const children = normalizeStringChildren(childResults)

  if (!role || role === 'presentation' || role === 'none') {
    return children
  }

  const name = getAccessibleName(el)
  const ariaNode: AriaNode = { role, name, children }

  const level = headingLevels[el.tagName]
  if (level) {
    ariaNode.level = level
  }

  if (el.getAttribute('aria-checked') != null) {
    const v = el.getAttribute('aria-checked')
    ariaNode.checked = v === 'mixed' ? 'mixed' : v === 'true'
  }
  if (el.getAttribute('aria-disabled') === 'true') {
    ariaNode.disabled = true
  }
  if (el.getAttribute('aria-expanded') != null) {
    ariaNode.expanded = el.getAttribute('aria-expanded') === 'true'
  }
  if (el.getAttribute('aria-pressed') != null) {
    const v = el.getAttribute('aria-pressed')
    ariaNode.pressed = v === 'mixed' ? 'mixed' : v === 'true'
  }
  if (el.getAttribute('aria-selected') === 'true') {
    ariaNode.selected = true
  }

  if (ariaNode.children.length === 1 && ariaNode.children[0] === ariaNode.name) {
    ariaNode.children = []
  }

  return [ariaNode]
}

function normalizeStringChildren(items: (AriaNode | string)[]): (AriaNode | string)[] {
  const result: (AriaNode | string)[] = []
  let buf = ''
  for (const item of items) {
    if (typeof item === 'string') {
      buf += item
    }
    else {
      const text = buf.replace(/\s+/g, ' ').trim()
      if (text) {
        result.push(text)
      }
      buf = ''
      result.push(item)
    }
  }
  const text = buf.replace(/\s+/g, ' ').trim()
  if (text) {
    result.push(text)
  }
  return result
}

export function captureAriaTree(root: Element): AriaNode {
  const children: (AriaNode | string)[] = []
  for (let child = root.firstChild; child; child = child.nextSibling) {
    children.push(...captureNode(child))
  }
  return { role: 'fragment', name: '', children: normalizeStringChildren(children) }
}

// ---------------------------------------------------------------------------
// render – AriaNode tree -> YAML-like string (Playwright-compatible format)
// ---------------------------------------------------------------------------

export function renderAriaTree(node: AriaNode): string {
  const lines: string[] = []
  const children = node.role === 'fragment' ? node.children : [node]

  for (const child of children) {
    if (typeof child === 'string') {
      lines.push(`- text: ${child}`)
    }
    else {
      renderNode(child, '', lines)
    }
  }
  return lines.join('\n')
}

function renderNode(node: AriaNode, indent: string, lines: string[]): void {
  let key = node.role
  if (node.name) {
    key += ` ${JSON.stringify(node.name)}`
  }
  if (node.level) {
    key += ` [level=${node.level}]`
  }
  if (node.checked === true) {
    key += ' [checked]'
  }
  if (node.checked === 'mixed') {
    key += ' [checked=mixed]'
  }
  if (node.disabled) {
    key += ' [disabled]'
  }
  if (node.expanded === true) {
    key += ' [expanded]'
  }
  if (node.expanded === false) {
    key += ' [expanded=false]'
  }
  if (node.pressed === true) {
    key += ' [pressed]'
  }
  if (node.pressed === 'mixed') {
    key += ' [pressed=mixed]'
  }
  if (node.selected) {
    key += ' [selected]'
  }

  if (!node.children.length) {
    lines.push(`${indent}- ${key}`)
    return
  }

  if (node.children.length === 1 && typeof node.children[0] === 'string') {
    lines.push(`${indent}- ${key}: ${node.children[0]}`)
    return
  }

  lines.push(`${indent}- ${key}:`)
  for (const child of node.children) {
    if (typeof child === 'string') {
      lines.push(`${indent}  - text: ${child}`)
    }
    else {
      renderNode(child, `${indent}  `, lines)
    }
  }
}

// ---------------------------------------------------------------------------
// parseExpected – YAML-like string -> AriaTemplateNode tree
// ---------------------------------------------------------------------------

export function parseAriaTemplate(text: string): AriaTemplateRoleNode {
  const lines = text.split('\n')
  const root: AriaTemplateRoleNode = { kind: 'role', role: 'fragment', children: [] }
  const stack: { node: AriaTemplateRoleNode; indent: number }[] = [{ node: root, indent: -1 }]

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }
    const indent = line.search(/\S/)
    const content = line.trim()
    if (!content.startsWith('- ')) {
      continue
    }

    const entry = content.slice(2)

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }
    const parent = stack[stack.length - 1].node

    if (entry.startsWith('text: ')) {
      const textValue = entry.slice(6).trim()
      parent.children!.push({
        kind: 'text',
        text: parseTextValue(textValue),
      })
      continue
    }

    const parsed = parseRoleEntry(entry)
    parent.children!.push(parsed.node)
    if (parsed.hasChildren) {
      stack.push({ node: parsed.node, indent })
    }
  }

  return root
}

function parseTextValue(raw: string): string | RegExp {
  if (raw.startsWith('/') && raw.endsWith('/') && raw.length > 1) {
    return new RegExp(raw.slice(1, -1))
  }
  return raw
}

function parseRoleEntry(entry: string): { node: AriaTemplateRoleNode; hasChildren: boolean } {
  let hasChildren = false
  let rest = entry

  const roleMatch = rest.match(/^(\w[\w-]*)/)
  if (!roleMatch) {
    throw new Error(`Cannot parse aria template entry: ${entry}`)
  }
  const role = roleMatch[1]
  rest = rest.slice(role.length).trim()

  let name: string | RegExp | undefined
  if (rest.startsWith('"')) {
    const endQuote = rest.indexOf('"', 1)
    if (endQuote > 0) {
      name = rest.slice(1, endQuote)
      rest = rest.slice(endQuote + 1).trim()
    }
  }
  else if (rest.startsWith('/')) {
    const endSlash = rest.indexOf('/', 1)
    if (endSlash > 0) {
      name = new RegExp(rest.slice(1, endSlash))
      rest = rest.slice(endSlash + 1).trim()
    }
  }

  const node: AriaTemplateRoleNode = { kind: 'role', role, children: [] }
  if (name !== undefined) {
    node.name = name
  }

  const attrRegex = /\[(\w+)(?:=(\w+))?\]/g
  let attrMatch
  // eslint-disable-next-line no-cond-assign
  while ((attrMatch = attrRegex.exec(rest)) !== null) {
    const [, attr, val] = attrMatch
    if (attr === 'level') {
      node.level = Number(val)
    }
    else if (attr === 'checked') {
      node.checked = val === 'mixed' ? 'mixed' : true
    }
    else if (attr === 'disabled') {
      node.disabled = true
    }
    else if (attr === 'expanded') {
      node.expanded = val !== 'false'
    }
    else if (attr === 'pressed') {
      node.pressed = val === 'mixed' ? 'mixed' : true
    }
    else if (attr === 'selected') {
      node.selected = true
    }
  }

  const inlineColonMatch = rest.match(/:\s*(\S.*)$/)
  if (inlineColonMatch) {
    const textVal = inlineColonMatch[1].trim()
    if (textVal) {
      node.children = [{
        kind: 'text',
        text: parseTextValue(textVal),
      }]
    }
  }
  else if (rest.endsWith(':')) {
    hasChildren = true
  }

  return { node, hasChildren }
}

// ---------------------------------------------------------------------------
// match – AriaNode tree vs AriaTemplateNode tree
// ---------------------------------------------------------------------------

function matchesText(actual: string, template: string | RegExp): boolean {
  if (typeof template === 'string') {
    return actual === template
  }
  return template.test(actual)
}

function matchesName(actual: string, template: string | RegExp | undefined): boolean {
  if (template === undefined) {
    return true
  }
  return matchesText(actual, template)
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode): boolean {
  if (typeof node === 'string' && template.kind === 'text') {
    return matchesText(node, template.text)
  }

  if (typeof node === 'string' || template.kind !== 'role') {
    return false
  }

  if (template.role !== 'fragment' && template.role !== node.role) {
    return false
  }
  if (!matchesName(node.name, template.name)) {
    return false
  }
  if (template.level !== undefined && template.level !== node.level) {
    return false
  }
  if (template.checked !== undefined && template.checked !== node.checked) {
    return false
  }
  if (template.disabled !== undefined && template.disabled !== node.disabled) {
    return false
  }
  if (template.expanded !== undefined && template.expanded !== node.expanded) {
    return false
  }
  if (template.pressed !== undefined && template.pressed !== node.pressed) {
    return false
  }
  if (template.selected !== undefined && template.selected !== node.selected) {
    return false
  }

  return containsList(node.children, template.children || [])
}

function containsList(children: (AriaNode | string)[], templates: AriaTemplateNode[]): boolean {
  if (templates.length === 0) {
    return true
  }
  if (templates.length > children.length) {
    return false
  }

  const cc = children.slice()
  for (const t of templates) {
    let found = false
    while (cc.length) {
      const c = cc.shift()!
      if (matchesNode(c, t)) {
        found = true
        break
      }
    }
    if (!found) {
      return false
    }
  }
  return true
}

export function matchAriaTree(root: AriaNode, template: AriaTemplateNode): boolean {
  if (matchesNode(root, template)) {
    return true
  }
  for (const child of root.children) {
    if (typeof child !== 'string' && matchAriaTree(child, template)) {
      return true
    }
  }
  return false
}

export const ariaDomainAdapter: DomainSnapshotAdapter<AriaNode, AriaTemplateRoleNode> = {
  name: 'aria',

  capture(received) {
    if (received instanceof Element) {
      return captureAriaTree(received)
    }
    throw new TypeError('aria adapter expects an Element')
  },

  render(captured) {
    return `\n${renderAriaTree(captured)}\n`
  },

  parseExpected(input) {
    return parseAriaTemplate(input.trim())
  },

  match(captured, expected): DomainMatchResult {
    if (typeof expected === 'string') {
      expected = parseAriaTemplate(expected.trim())
    }
    const pass = matchAriaTree(captured, expected)
    return {
      pass,
      message: pass ? undefined : 'ARIA tree does not match expected template',
    }
  },
}
