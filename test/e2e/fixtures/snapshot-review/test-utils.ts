import { afterEach, expect, inject, Snapshots } from 'vitest'
import type { DomainSnapshotAdapter, SnapshotSerializer } from 'vitest'

export function record(id: string) {
  return { title: 'Snapshot catalogue', status: 'ready', count: 2, items: ['inline', 'file'] }
}

export function packet(id: string) {
  return { kind: 'packet', route: '/catalogue', payload: record(id) }
}

export function failure(id: string) {
  return new TypeError('Invalid snapshot input')
}

export function catalogue(id: string) {
  return { name: 'Snapshot catalogue', status: 'ready', revision: '42', extra: 'ignored by subsets' }
}

export function mountCatalogue() {
  const main = globalThis.document.createElement('main')
  main.setAttribute('aria-label', 'Catalogue')
  const heading = globalThis.document.createElement('h1')
  heading.textContent = 'Snapshot catalogue'
  const list = globalThis.document.createElement('ul')
  list.setAttribute('aria-label', 'Snapshot kinds')
  for (const [index, label] of ['Inline snapshots', 'File snapshots'].entries()) {
    const item = globalThis.document.createElement('li')
    item.textContent = label
    list.append(item)
  }
  const button = globalThis.document.createElement('button')
  button.textContent = 'Capture snapshot'
  main.append(heading, list, button)
  globalThis.document.body.append(main)
  return main
}

// Configured serializer; raw file snapshots bypass this serializer.
export default {
  test: value => value !== null && typeof value === 'object' && value.kind === 'packet',
  serialize(value, config, indentation, depth, refs, printer) {
    return `Packet ${value.route}\n${printer(value.payload, config, indentation, depth, refs)}`
  },
} satisfies SnapshotSerializer

type Entries = Record<string, string>
type Template = Record<string, string | RegExp>

function render(entries: Template) {
  return `\n${Object.keys(entries).sort().map(key => `${key}=${entries[key]}`).join('\n')}\n`
}

const catalogueAdapter: DomainSnapshotAdapter<Entries, Template> = {
  name: 'catalogue-kv',
  capture(received) {
    return Object.fromEntries(Object.entries(received as Entries).map(([key, value]) => [key, String(value)]))
  },
  render,
  parseExpected(input) {
    return Object.fromEntries(input.trim().split('\n').map(line => {
      const separator = line.indexOf('=')
      if (separator < 1) throw new TypeError(`Invalid catalogue entry: ${line}`)
      const value = line.slice(separator + 1)
      return [line.slice(0, separator), value.startsWith('/') && value.endsWith('/')
        ? new RegExp(value.slice(1, -1))
        : value]
    }))
  },
  match(captured, expected) {
    let pass = true
    const resolved: Entries = {}
    for (const [key, template] of Object.entries(expected)) {
      const actual = captured[key]
      const matches = actual !== undefined && (template instanceof RegExp ? template.test(actual) : actual === template)
      pass &&= matches
      // Keep matching regexes and subset keys intact when updating.
      resolved[key] = matches ? String(template) : actual ?? '<missing>'
    }
    return { pass, resolved: render(resolved), expected: render(expected) }
  },
}

export function installSnapshotMatchers() {
  expect.addSnapshotSerializer({
    test: value => value !== null && typeof value === 'object' && value.kind === 'badge',
    serialize: value => `Badge(${value.label})`,
  })
  expect.extend({
    toMatchCatalogueSnapshot(received: unknown) {
      return Snapshots.toMatchDomainSnapshot.call(this, catalogueAdapter, received)
    },
    toMatchCatalogueInlineSnapshot(received: unknown, inlineSnapshot?: string) {
      return Snapshots.toMatchDomainInlineSnapshot.call(this, catalogueAdapter, received, inlineSnapshot)
    },
    toMatchUppercaseSnapshot(received: string) {
      return Snapshots.toMatchSnapshot.call(this, received.toUpperCase())
    },
    toMatchUppercaseInlineSnapshot(received: string, inlineSnapshot?: string) {
      return Snapshots.toMatchInlineSnapshot.call(this, received.toUpperCase(), inlineSnapshot)
    },
    async toMatchUppercaseFileSnapshot(received: string, file: string) {
      return Snapshots.toMatchFileSnapshot.call(this, received.toUpperCase(), file)
    },
  })
  afterEach(() => {
    if (typeof globalThis.document !== 'undefined') globalThis.document.body.replaceChildren()
  })
}

declare module 'vitest' {
  interface ProvidedContext {
    distilledGlitchSeed: string
  }
  interface Matchers<R, T> {
    toMatchCatalogueSnapshot(): R
    toMatchCatalogueInlineSnapshot(inlineSnapshot?: string): R
    toMatchUppercaseSnapshot(): R
    toMatchUppercaseInlineSnapshot(inlineSnapshot?: string): R
    toMatchUppercaseFileSnapshot(file: string): Promise<void>
  }
}
