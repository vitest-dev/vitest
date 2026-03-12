/**
 * Prototype ARIA snapshot pipeline.
 *
 * Simplified version of Playwright's aria snapshot:
 *   captureAriaTree  – walk DOM, build AriaNode tree
 *   renderAriaTree   – serialize tree to YAML-like text
 *   parseAriaTemplate – parse YAML-like template back into AriaTemplateNode tree
 *   matchAriaTree    – compare captured tree against template (contain semantics + regex names)
 *
 * Based on Playwright v1.58.2:
 *   Capture & render: https://github.com/microsoft/playwright/blob/v1.58.2/packages/injected/src/ariaSnapshot.ts
 *   Parse & match:    https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts
 *   Tests:            https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/to-match-aria-snapshot.spec.ts
 *                     https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/page-aria-snapshot.spec.ts
 *
 * Not yet implemented (vs Playwright v1.58.2):
 *
 *   Moderate:
 *   - /children: equal|deep-equal|contain directives
 *     → add matching mode flag threaded through containsList/mergeChildLists (~50 lines)
 *   - Role/attribute parse error reporting with source location
 *     → track position in parseRoleEntry for unterminated strings/regex, invalid
 *       attribute values, unsupported attributes, unexpected text; format error
 *       message with caret like Playwright does (~30 lines)
 *   - YAML quoting/escaping (we use simplified parser, not full YAML)
 *     → quote names containing :, ", #, YAML-special values in render; unquote in parse (~60 lines)
 *   - YAML block scalars (| multiline syntax)
 *     → extend parser to detect | and read indented continuation lines (~20 lines)
 *
 *   Moderate (requires careful DOM traversal work):
 *   - CSS visibility:hidden checks (we only check aria-hidden and hidden attr)
 *     → call getComputedStyle(el) in isHidden(), check visibility/display/opacity.
 *       Runs in real browser so API is available. Main concern: getComputedStyle()
 *       forces layout; calling it per-element during tree walk may be slow on large
 *       DOMs. Playwright batches visibility checks. ~15 lines for basic support.
 *   - CSS pseudo-elements (::before, ::after) text inclusion
 *     → call getComputedStyle(el, '::before').content in captureNode(), prepend/append
 *       the text to children. Need to handle 'none'/'normal'/quoted-string values and
 *       strip quotes. Same perf concern as visibility. ~20 lines.
 *   - Shadow DOM / slots
 *     → in captureNode(), check el.shadowRoot and walk it instead of light DOM children.
 *       For slots: walk slot.assignedNodes() (or fallback content if none assigned).
 *       Must avoid double-counting slotted content (skip slotted nodes in light DOM
 *       walk, only visit them via slot). ~40 lines.
 *   - aria-owns
 *     → need a pre-pass before tree walk: parse aria-owns attrs to build a Map<id, owner>.
 *       During captureNode(), append owned elements as children of the owner instead of
 *       their DOM parent. Must detect and break cycles. First valid owner wins per spec.
 *       ~50 lines + changes to captureAriaTree entry point.
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
  url?: string
  placeholder?: string
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
  url?: string | RegExp
  placeholder?: string | RegExp
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

  // Capture URL for links
  if (el.tagName === 'A' && el.hasAttribute('href')) {
    ariaNode.url = el.getAttribute('href')!
  }

  // Capture placeholder for inputs
  if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.hasAttribute('placeholder')) {
    const placeholder = el.getAttribute('placeholder')!
    if (placeholder && placeholder !== ariaNode.name) {
      ariaNode.placeholder = placeholder
    }
  }

  // Capture input/textarea value as text content
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() || 'text'
    if (type !== 'checkbox' && type !== 'radio' && type !== 'file') {
      const value = (el as HTMLInputElement).value
      if (value) {
        ariaNode.children = [value]
      }
    }
  }
  else if (el.tagName === 'TEXTAREA') {
    const value = (el as HTMLTextAreaElement).value
    if (value) {
      ariaNode.children = [value]
    }
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

  const pseudoChildren: string[] = []
  if (node.url !== undefined) {
    pseudoChildren.push(`${indent}  - /url: ${node.url}`)
  }
  if (node.placeholder !== undefined) {
    pseudoChildren.push(`${indent}  - /placeholder: ${node.placeholder}`)
  }

  if (!node.children.length && !pseudoChildren.length) {
    lines.push(`${indent}- ${key}`)
    return
  }

  if (node.children.length === 1 && typeof node.children[0] === 'string' && !pseudoChildren.length) {
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
  lines.push(...pseudoChildren)
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

    if (entry.startsWith('/url: ')) {
      const val = entry.slice(6).trim()
      parent.url = parseTextValue(val)
      continue
    }

    if (entry.startsWith('/placeholder: ')) {
      const val = entry.slice(14).trim()
      parent.placeholder = parseTextValue(val)
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
      node.checked = val === 'mixed' ? 'mixed' : val !== 'false'
    }
    else if (attr === 'disabled') {
      node.disabled = val !== 'false'
    }
    else if (attr === 'expanded') {
      node.expanded = val !== 'false'
    }
    else if (attr === 'pressed') {
      node.pressed = val === 'mixed' ? 'mixed' : val !== 'false'
    }
    else if (attr === 'selected') {
      node.selected = val !== 'false'
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

export interface MatchAriaResult {
  pass: boolean
  actual: string
  expected: string
  mergedExpected: string
}

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
  if (template.url !== undefined && !matchesName(node.url || '', template.url)) {
    return false
  }
  if (template.placeholder !== undefined && !matchesName(node.placeholder || '', template.placeholder)) {
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

// --- Detailed match with merge ---

function formatName(name: string | RegExp): string {
  if (name instanceof RegExp) {
    return `/${name.source}/`
  }
  return JSON.stringify(name)
}

function renderKey(node: AriaNode, nameOverride?: string | RegExp): string {
  let key = node.role
  const name = nameOverride !== undefined ? nameOverride : node.name
  if (name) {
    key += ` ${typeof name === 'string' ? JSON.stringify(name) : formatName(name)}`
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
  return key
}

function renderTemplateKey(tmpl: AriaTemplateRoleNode): string {
  let key = tmpl.role
  if (tmpl.name !== undefined) {
    key += ` ${formatName(tmpl.name)}`
  }
  if (tmpl.level) {
    key += ` [level=${tmpl.level}]`
  }
  if (tmpl.checked === true) {
    key += ' [checked]'
  }
  if (tmpl.checked === 'mixed') {
    key += ' [checked=mixed]'
  }
  if (tmpl.disabled) {
    key += ' [disabled]'
  }
  if (tmpl.expanded === true) {
    key += ' [expanded]'
  }
  if (tmpl.expanded === false) {
    key += ' [expanded=false]'
  }
  if (tmpl.pressed === true) {
    key += ' [pressed]'
  }
  if (tmpl.pressed === 'mixed') {
    key += ' [pressed=mixed]'
  }
  if (tmpl.selected) {
    key += ' [selected]'
  }
  return key
}

function formatText(text: string | RegExp): string {
  if (text instanceof RegExp) {
    return `/${text.source}/`
  }
  return text
}

interface MergeLines {
  actual: string[]
  expected: string[]
  merged: string[]
  pass: boolean
}

function pairChildren(
  children: (AriaNode | string)[],
  templates: AriaTemplateNode[],
): Map<number, number> {
  const pairs = new Map<number, number>()
  let ti = 0
  for (let ci = 0; ci < children.length && ti < templates.length; ci++) {
    if (matchesNode(children[ci], templates[ti])) {
      pairs.set(ci, ti)
      ti++
    }
  }
  return pairs
}

function mergeChildLists(
  children: (AriaNode | string)[],
  templates: AriaTemplateNode[],
  indent: string,
): MergeLines {
  const actual: string[] = []
  const expected: string[] = []
  const merged: string[] = []

  const pairs = pairChildren(children, templates)
  const allTemplatesMatched = pairs.size === templates.length

  // Render all actual children (used in both branches)
  function renderChild(child: AriaNode | string): string[] {
    const lines: string[] = []
    if (typeof child === 'string') {
      lines.push(`${indent}- text: ${child}`)
    }
    else {
      renderNode(child, indent, lines)
    }
    return lines
  }

  if (!allTemplatesMatched) {
    // BAIL OUT: some template had no match — render full actual (maximally strict).
    // For paired children, use mergeNode to preserve regex patterns in merged.
    // For unpaired actuals, render from actual (strict).
    const mergeResults = new Map<number, MergeLines>()
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]
      const ti = pairs.get(ci)
      if (ti !== undefined) {
        const r = mergeNode(child, templates[ti], indent)
        mergeResults.set(ti, r)
        actual.push(...r.actual)
        merged.push(...r.merged)
      }
      else {
        const rendered = renderChild(child)
        actual.push(...rendered)
        merged.push(...rendered)
      }
    }

    // Build expected in template order (matched and unmatched interleaved).
    for (let ti = 0; ti < templates.length; ti++) {
      const r = mergeResults.get(ti)
      if (r) {
        expected.push(...r.expected)
      }
      else {
        const tmpl = templates[ti]
        if (tmpl.kind === 'text') {
          expected.push(`${indent}- text: ${formatText(tmpl.text)}`)
        }
        else {
          const tmplLines: string[] = []
          renderTemplateNode(tmpl, indent, tmplLines)
          expected.push(...tmplLines)
        }
      }
    }

    return { actual, expected, merged, pass: false }
  }

  // PARTIAL MERGE: all templates matched — preserve partial structure.
  // Unpaired actuals are omitted from merged (user intentionally omitted them).
  let allPass = true
  for (let ci = 0; ci < children.length; ci++) {
    const child = children[ci]
    const ti = pairs.get(ci)

    if (ti !== undefined) {
      const r = mergeNode(child, templates[ti], indent)
      actual.push(...r.actual)
      expected.push(...r.expected)
      merged.push(...r.merged)
      if (!r.pass) {
        allPass = false
      }
    }
    else {
      // Unpaired actual — in actual only, keep out of merged (preserve partial)
      actual.push(...renderChild(child))
    }
  }

  return { actual, expected, merged, pass: allPass }
}

function renderTemplateNode(tmpl: AriaTemplateRoleNode, indent: string, lines: string[]): void {
  const key = renderTemplateKey(tmpl)
  const children = tmpl.children || []

  if (children.length === 0) {
    lines.push(`${indent}- ${key}`)
    return
  }
  if (children.length === 1 && children[0].kind === 'text') {
    lines.push(`${indent}- ${key}: ${formatText(children[0].text)}`)
    return
  }
  lines.push(`${indent}- ${key}:`)
  for (const child of children) {
    if (child.kind === 'text') {
      lines.push(`${indent}  - text: ${formatText(child.text)}`)
    }
    else {
      renderTemplateNode(child, `${indent}  `, lines)
    }
  }
}

function mergeNode(
  node: AriaNode | string,
  template: AriaTemplateNode,
  indent: string,
): MergeLines {
  // Text node
  if (typeof node === 'string' && template.kind === 'text') {
    const matched = matchesText(node, template.text)
    if (matched && template.text instanceof RegExp) {
      // Regex matched — show pattern form in all three (cancels in diff)
      const patternStr = `${indent}- text: ${formatText(template.text)}`
      return { actual: [patternStr], expected: [patternStr], merged: [patternStr], pass: true }
    }
    if (matched) {
      const line = `${indent}- text: ${node}`
      return { actual: [line], expected: [line], merged: [line], pass: true }
    }
    return {
      actual: [`${indent}- text: ${node}`],
      expected: [`${indent}- text: ${formatText(template.text)}`],
      merged: [`${indent}- text: ${node}`],
      pass: false,
    }
  }

  if (typeof node === 'string' || template.kind !== 'role') {
    // Shouldn't happen if matchesNode passed, but handle gracefully
    const actualLine = typeof node === 'string'
      ? `${indent}- text: ${node}`
      : (() => {
          const l: string[] = []
          renderNode(node, indent, l)
          return l.join('\n')
        })()
    return { actual: [actualLine], expected: [], merged: [actualLine], pass: false }
  }

  // Role node — determine the name to show
  let namePass = true
  let mergedName: string | RegExp = node.name
  if (template.name !== undefined) {
    if (template.name instanceof RegExp) {
      if (template.name.test(node.name)) {
        // Regex matched — use pattern form in actual/expected (cancels in diff), keep pattern in merged
        mergedName = template.name
      }
      else {
        namePass = false
      }
    }
    else {
      if (template.name !== node.name) {
        namePass = false
      }
    }
  }

  const attrPass = (template.level === undefined || template.level === node.level)
    && (template.checked === undefined || template.checked === node.checked)
    && (template.disabled === undefined || template.disabled === node.disabled)
    && (template.expanded === undefined || template.expanded === node.expanded)
    && (template.pressed === undefined || template.pressed === node.pressed)
    && (template.selected === undefined || template.selected === node.selected)
    && (template.url === undefined || matchesName(node.url || '', template.url))
    && (template.placeholder === undefined || matchesName(node.placeholder || '', template.placeholder))

  // Build the key line for each output
  // When name regex matched, use pattern form in actual too (so it cancels in diff)
  const actualKey = namePass && template.name instanceof RegExp
    ? renderKey(node, template.name)
    : renderKey(node)
  const expectedKey = renderTemplateKey(template)
  const mergedKey = renderKey(node, mergedName)

  // Recurse into children
  const childResult = mergeChildLists(
    node.children,
    template.children || [],
    `${indent}  `,
  )

  // Build pseudo-child lines for /url: and /placeholder:
  const pseudoLines: string[] = []
  if (node.url !== undefined) {
    pseudoLines.push(`${indent}  - /url: ${node.url}`)
  }
  if (node.placeholder !== undefined) {
    pseudoLines.push(`${indent}  - /placeholder: ${node.placeholder}`)
  }

  const pass = namePass && attrPass && childResult.pass

  const actual: string[] = []
  const expected: string[] = []
  const merged: string[] = []

  const hasActualChildren = childResult.actual.length > 0 || pseudoLines.length > 0
  const hasExpectedChildren = childResult.expected.length > 0 || pseudoLines.length > 0
  const hasMergedChildren = childResult.merged.length > 0 || pseudoLines.length > 0

  if (!hasActualChildren) {
    actual.push(`${indent}- ${actualKey}`)
  }
  else if (childResult.actual.length === 1 && !pseudoLines.length && childResult.actual[0].trimStart().startsWith('- text: ')) {
    const text = childResult.actual[0].trimStart().slice('- text: '.length)
    actual.push(`${indent}- ${actualKey}: ${text}`)
  }
  else {
    actual.push(`${indent}- ${actualKey}:`)
    actual.push(...childResult.actual)
    actual.push(...pseudoLines)
  }

  if (!hasExpectedChildren) {
    expected.push(`${indent}- ${expectedKey}`)
  }
  else if (childResult.expected.length === 1 && !pseudoLines.length && childResult.expected[0].trimStart().startsWith('- text: ')) {
    const text = childResult.expected[0].trimStart().slice('- text: '.length)
    expected.push(`${indent}- ${expectedKey}: ${text}`)
  }
  else {
    expected.push(`${indent}- ${expectedKey}:`)
    expected.push(...childResult.expected)
    expected.push(...pseudoLines)
  }

  if (!hasMergedChildren) {
    merged.push(`${indent}- ${mergedKey}`)
  }
  else if (childResult.merged.length === 1 && !pseudoLines.length && childResult.merged[0].trimStart().startsWith('- text: ')) {
    const text = childResult.merged[0].trimStart().slice('- text: '.length)
    merged.push(`${indent}- ${mergedKey}: ${text}`)
  }
  else {
    merged.push(`${indent}- ${mergedKey}:`)
    merged.push(...childResult.merged)
    merged.push(...pseudoLines)
  }

  return { actual, expected, merged, pass }
}

export function matchAriaTree(root: AriaNode, template: AriaTemplateNode): MatchAriaResult {
  // The template is always a fragment at top level
  if (template.kind !== 'role') {
    const rendered = renderAriaTree(root)
    return {
      pass: false,
      actual: rendered,
      expected: formatText((template as AriaTemplateTextNode).text),
      mergedExpected: rendered,
    }
  }

  const result = mergeChildLists(
    root.role === 'fragment' ? root.children : [root],
    template.role === 'fragment' ? (template.children || []) : [template],
    '',
  )

  return {
    pass: result.pass,
    actual: result.actual.join('\n'),
    expected: result.expected.join('\n'),
    mergedExpected: result.merged.join('\n'),
  }
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
    const result = matchAriaTree(captured, expected)
    return {
      pass: result.pass,
      message: result.pass ? undefined : 'ARIA tree does not match expected template',
      actual: `\n${result.actual}\n`,
      expected: `\n${result.expected}\n`,
      mergedExpected: `\n${result.mergedExpected}\n`,
    }
  },
}
