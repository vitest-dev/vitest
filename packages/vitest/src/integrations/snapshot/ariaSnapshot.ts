import type { DomainSnapshotAdapter } from '@vitest/snapshot'

interface AriaNode {
  role: string
  name: string
  attributes: string[]
  text: string[]
  children: AriaNode[]
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function escapeSnapshotString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isElement(value: unknown): value is Element {
  return !!value
    && typeof value === 'object'
    && 'nodeType' in value
    && (value as { nodeType: number }).nodeType === 1
}

function getAriaBooleanAttribute(
  element: Element,
  name: string,
): boolean | undefined {
  const value = element.getAttribute(name)
  if (value == null) {
    return undefined
  }
  if (value === '' || value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

function getTextContent(element: Element): string {
  return normalizeWhitespace(element.textContent || '')
}

function getImplicitRole(element: Element): string {
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'a' && element.hasAttribute('href')) {
    return 'link'
  }
  if (tagName === 'button') {
    return 'button'
  }
  if (/^h[1-6]$/.test(tagName)) {
    return 'heading'
  }
  if (tagName === 'img') {
    return 'img'
  }
  if (tagName === 'textarea') {
    return 'textbox'
  }
  if (tagName === 'select') {
    return 'combobox'
  }
  if (tagName === 'option') {
    return 'option'
  }
  if (tagName === 'li') {
    return 'listitem'
  }
  if (tagName === 'ul' || tagName === 'ol') {
    return 'list'
  }
  if (tagName === 'main') {
    return 'main'
  }
  if (tagName === 'nav') {
    return 'navigation'
  }

  if (tagName === 'input') {
    const type = element.getAttribute('type')?.toLowerCase() || 'text'
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return 'button'
    }
    if (type === 'checkbox') {
      return 'checkbox'
    }
    if (type === 'radio') {
      return 'radio'
    }
    return 'textbox'
  }

  return 'generic'
}

function getRole(element: Element): string {
  const explicitRole = element.getAttribute('role')
  if (explicitRole) {
    return explicitRole.split(/\s+/)[0]
  }
  return getImplicitRole(element)
}

function getNameFromAriaLabelledby(element: Element): string {
  const ariaLabelledby = element.getAttribute('aria-labelledby')
  if (!ariaLabelledby) {
    return ''
  }

  const ids = ariaLabelledby.split(/\s+/).filter(Boolean)
  const ownerDocument = element.ownerDocument
  if (!ownerDocument) {
    return ''
  }

  const value = ids
    .map(id => ownerDocument.getElementById(id))
    .filter((label): label is HTMLElement => label !== null)
    .map(label => getTextContent(label))
    .filter(Boolean)
    .join(' ')

  return normalizeWhitespace(value)
}

function getName(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) {
    return normalizeWhitespace(ariaLabel)
  }

  const labelledBy = getNameFromAriaLabelledby(element)
  if (labelledBy) {
    return labelledBy
  }

  if (element.tagName.toLowerCase() === 'img') {
    const alt = element.getAttribute('alt')
    if (alt) {
      return normalizeWhitespace(alt)
    }
  }

  if (element.tagName.toLowerCase() === 'input') {
    const value = element.getAttribute('value')
    if (value) {
      return normalizeWhitespace(value)
    }
  }

  return getTextContent(element)
}

function getStateAttributes(element: Element): string[] {
  const attributes: string[] = []

  const checked = getAriaBooleanAttribute(element, 'aria-checked')
  if (checked !== undefined) {
    attributes.push(`checked=${checked}`)
  }

  const expanded = getAriaBooleanAttribute(element, 'aria-expanded')
  if (expanded !== undefined) {
    attributes.push(`expanded=${expanded}`)
  }

  const pressed = getAriaBooleanAttribute(element, 'aria-pressed')
  if (pressed !== undefined) {
    attributes.push(`pressed=${pressed}`)
  }

  const selected = getAriaBooleanAttribute(element, 'aria-selected')
  if (selected !== undefined) {
    attributes.push(`selected=${selected}`)
  }

  const level = element.getAttribute('aria-level')
  if (level) {
    attributes.push(`level=${level}`)
  }

  const hasDisabled
    = element.hasAttribute('disabled')
      || getAriaBooleanAttribute(element, 'aria-disabled') === true
  if (hasDisabled) {
    attributes.push('disabled=true')
  }

  return attributes
}

function buildAriaNode(element: Element): AriaNode {
  const text = Array.from(element.childNodes)
    .filter(node => node.nodeType === 3)
    .map(node => normalizeWhitespace(node.textContent || ''))
    .filter(Boolean)

  return {
    role: getRole(element),
    name: getName(element),
    attributes: getStateAttributes(element),
    text,
    children: Array.from(element.children).map(child => buildAriaNode(child)),
  }
}

function renderNode(node: AriaNode, indentation: string, lines: string[]): void {
  const renderedAttributes = node.attributes.length
    ? ` [${node.attributes.join(' ')}]`
    : ''
  lines.push(
    `${indentation}- ${node.role}${node.name ? ` "${escapeSnapshotString(node.name)}"` : ''}${renderedAttributes}`,
  )

  for (const text of node.text) {
    lines.push(`${indentation}  - text "${escapeSnapshotString(text)}"`)
  }

  for (const child of node.children) {
    renderNode(child, `${indentation}  `, lines)
  }
}

function normalizeLines(snapshot: string): string[] {
  return snapshot
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function containsInOrder(actual: string[], expected: string[]): boolean {
  if (!expected.length) {
    return true
  }

  let expectedIndex = 0
  for (const actualLine of actual) {
    if (actualLine === expected[expectedIndex]) {
      expectedIndex++
      if (expectedIndex === expected.length) {
        return true
      }
    }
  }
  return false
}

export const ariaSnapshotAdapter: DomainSnapshotAdapter<AriaNode, string[]> = {
  name: 'aria',
  capture(received) {
    if (!isElement(received)) {
      throw new Error('toMatchAriaSnapshot expects a DOM Element as received value.')
    }
    return buildAriaNode(received)
  },
  render(captured) {
    const lines: string[] = []
    renderNode(captured, '', lines)
    return lines.join('\n')
  },
  parseExpected(input) {
    return normalizeLines(input)
  },
  match(captured, expectedLines, context, options) {
    const actualLines = normalizeLines(this.render(captured, context, 'assert', options))
    const normalizedExpectedLines
      = Array.isArray(expectedLines)
        ? expectedLines
        : normalizeLines(expectedLines)
    return {
      pass: containsInOrder(actualLines, normalizedExpectedLines),
    }
  },
}
