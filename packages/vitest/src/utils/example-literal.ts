const NOT_LITERAL = new Error('not a literal')
const IDENTIFIER = /^[a-z_$][\w$]*$/i
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/
// the text of a finite number
const NUMBER = /^-?\d+(?:\.\d+)?(?:e[+-]\d+)?$/
const TYPED_ARRAYS = new Set([
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
])
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype)
const getTypedArrayName = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag,
)!.get!
const getTypedArrayLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length')!.get!
const getMapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!
const getSetSize = Object.getOwnPropertyDescriptor(Set.prototype, 'size')!.get!

// A JavaScript literal as a tree: a text that stays on 1 line, or a group that can break into
// lines. `new Map([` and `])` are the brackets of the array of a map.
export type ExampleNode = string | ExampleGroup

interface ExampleGroup {
  open: string
  close: string
  // the brackets of an object have spaces inside
  object: boolean
  items: ExampleNode[]
  // the keys of an object, each with `: ` after it
  keys?: string[]
  // an array of numbers puts as many items on a line as fit
  fill: boolean
  // the length on 1 line
  width: number
}

interface NodeContext {
  seen: Set<object>
  // the width that the literal can still have
  remaining: number
}

// The literal of a value that creates an equal value, or `undefined` if the value has no such
// literal (a class instance, a function, a symbol, a getter or a cycle), or if the literal is
// wider than `maxWidth`. The checks do not use `instanceof`, because a value can come from
// another realm.
export function createExampleNode(
  value: unknown,
  maxWidth: number = Number.POSITIVE_INFINITY,
): ExampleNode | undefined {
  try {
    const node = createNode(value, { seen: new Set(), remaining: maxWidth })
    return getExampleNodeWidth(node) <= maxWidth ? node : undefined
  } catch (error) {
    if (error === NOT_LITERAL) {
      return undefined
    }
    throw error
  }
}

export function createExampleObject(
  entries: [key: string, value: ExampleNode][],
  nullPrototype = false,
): ExampleNode {
  if (!entries.length && !nullPrototype) {
    return '{}'
  }
  const values = entries.map(([, value]) => value)
  const keys = entries.map(([key]) => `${formatExampleKey(key)}: `)
  return nullPrototype
    ? createGroup('{', '}', ['null', ...values], ['__proto__: ', ...keys])
    : createGroup('{', '}', values, keys)
}

export function createExampleArray(items: ExampleNode[]): ExampleNode {
  return items.length ? createGroup('[', ']', items) : '[]'
}

export function getExampleNodeWidth(node: ExampleNode): number {
  return typeof node === 'string' ? node.length : node.width
}

// The text of the literal. A group that fits in the rest of its line stays on 1 line, else each
// item gets its own line, with 2 more spaces and a comma. `start` is the column of the first
// character, and `end` is the count of characters after the last one.
export function formatExampleNode(
  node: ExampleNode,
  width: number = Number.POSITIVE_INFINITY,
  start = 0,
  end = 0,
): string {
  return printNode(node, width, '', start, end)
}

// The keys of an example as a JavaScript property access, for example `network.delay`,
// `['@scope/pkg'].id`, or `$node[1]` for the item `index` of `$node`.
export function formatExamplePath(keys: readonly string[], index?: number): string {
  const path = keys
    .map((key, i) => (IDENTIFIER.test(key) ? (i ? `.${key}` : key) : `[${formatExampleKey(key)}]`))
    .join('')
  return index === undefined ? path : `${path}[${index}]`
}

function formatExampleKey(key: string): string {
  // only a computed `__proto__` key is a property, the other forms set the prototype
  if (key === '__proto__') {
    return `['__proto__']`
  }
  // a number key such as 2^53 + 1 changes when JavaScript reads it as a number
  const index = ARRAY_INDEX.test(key) && String(Number(key)) === key
  return index || IDENTIFIER.test(key) ? key : formatString(key)
}

function createGroup(
  open: string,
  close: string,
  items: ExampleNode[],
  keys?: string[],
): ExampleGroup {
  const object = keys !== undefined
  let width = open.length + close.length + 2 * (items.length - 1) + (object ? 2 : 0)
  for (const [i, item] of items.entries()) {
    width += getExampleNodeWidth(item) + (keys?.[i].length ?? 0)
  }
  // a hole at the end needs 1 more comma
  if (items.at(-1) === '') {
    width++
  }
  const fill =
    !object &&
    items.length > 1 &&
    items.every((item) => typeof item === 'string' && NUMBER.test(item))
  return { open, close, object, items, keys, fill, width }
}

function printNode(
  node: ExampleNode,
  width: number,
  indent: string,
  start: number,
  end: number,
): string {
  if (typeof node === 'string' || start + node.width + end <= width) {
    return printFlat(node)
  }
  const inner = `${indent}  `
  const lines = node.fill
    ? fillLines(node.items, width, inner)
    : node.items.map((item, i) => {
        const key = `${inner}${node.keys?.[i] ?? ''}`
        return `${key}${printNode(item, width, inner, key.length, 1)},`
      })
  return `${node.open}\n${lines.join('\n')}\n${indent}${node.close}`
}

function printFlat(node: ExampleNode): string {
  if (typeof node === 'string') {
    return node
  }
  const items = node.items.map((item, i) => `${node.keys?.[i] ?? ''}${printFlat(item)}`)
  const hole = node.items.at(-1) === '' ? ',' : ''
  const space = node.object ? ' ' : ''
  return `${node.open}${space}${items.join(', ')}${hole}${space}${node.close}`
}

function fillLines(items: ExampleNode[], width: number, indent: string): string[] {
  const lines: string[] = []
  let line = ''
  for (const item of items) {
    const text = `${printFlat(item)},`
    if (line && line.length + 1 + text.length <= width) {
      line += ` ${text}`
      continue
    }
    if (line) {
      lines.push(line)
    }
    line = `${indent}${text}`
  }
  lines.push(line)
  return lines
}

function createNode(value: unknown, context: NodeContext): ExampleNode {
  switch (typeof value) {
    case 'number':
      return createLeaf(Object.is(value, -0) ? '-0' : String(value), context)
    case 'string':
      // the quotes and the characters
      assertWidth(value.length + 2, context)
      return createLeaf(formatString(value), context)
    case 'boolean':
      return createLeaf(String(value), context)
    case 'undefined':
      return createLeaf('undefined', context)
    case 'bigint':
      return createLeaf(`${value}n`, context)
    case 'object':
      return value === null ? createLeaf('null', context) : createObjectNode(value, context)
    default:
      throw NOT_LITERAL
  }
}

// The texts, the keys and the separators reduce the remaining width, so the literal stops as soon
// as it is too wide. They are not all the characters, so the final width is checked at the end.
function reserveWidth(width: number, context: NodeContext): void {
  context.remaining -= width
  if (context.remaining < 0) {
    throw NOT_LITERAL
  }
}

function createLeaf(text: string, context: NodeContext): string {
  reserveWidth(text.length, context)
  return text
}

// a large value fails before its items are read
function assertWidth(width: number, context: NodeContext): void {
  if (width > context.remaining) {
    throw NOT_LITERAL
  }
}

function formatString(value: string): string {
  const json = JSON.stringify(value).slice(1, -1)
  return `'${json.replace(/\\"/g, '"').replace(/'/g, "\\'")}'`
}

function createObjectNode(value: object, context: NodeContext): ExampleNode {
  const { seen } = context
  if (seen.has(value)) {
    throw NOT_LITERAL
  }
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return createExampleArray(createArrayItems(value, context))
    }
    const proto = Object.getPrototypeOf(value)
    // `Object.prototype` of any realm, not another object without a prototype
    if (
      proto === null ||
      (Object.getPrototypeOf(proto) === null && Object.hasOwn(proto, 'isPrototypeOf'))
    ) {
      return createPlainObjectNode(value, proto === null, context)
    }
    // a built-in class has `Object.prototype` above its own prototype, a subclass does not
    if (Object.getPrototypeOf(Object.getPrototypeOf(proto)) !== null) {
      return createTypedArrayNode(value, context)
    }
    const tag = Object.prototype.toString.call(value)
    if (Reflect.ownKeys(value).length) {
      throw NOT_LITERAL
    }
    // the methods of the prototype check that the value is a real map, set or date, and each
    // item has at least 2 characters
    if (tag === '[object Map]') {
      assertWidth(2 * getMapSize.call(value), context)
      const entries = [...Map.prototype.entries.call(value)]
      return entries.length
        ? createCallNode('Map', createArrayItems(entries, context))
        : createLeaf('new Map()', context)
    }
    if (tag === '[object Set]') {
      assertWidth(2 * getSetSize.call(value), context)
      const items = [...Set.prototype.values.call(value)]
      return items.length
        ? createCallNode('Set', createArrayItems(items, context))
        : createLeaf('new Set()', context)
    }
    if (tag === '[object Date]') {
      const time = Date.prototype.getTime.call(value)
      return createLeaf(
        Number.isNaN(time) ? 'new Date(NaN)' : `new Date('${new Date(time).toISOString()}')`,
        context,
      )
    }
    throw NOT_LITERAL
  } catch (error) {
    // a brand check of a prototype method throws a `TypeError` for an object that only looks
    // like a map, a set or a date
    throw error instanceof TypeError ? NOT_LITERAL : error
  } finally {
    seen.delete(value)
  }
}

// `new Map([` stays on the line of the key when the array breaks
function createCallNode(name: string, items: ExampleNode[]): ExampleNode {
  return createGroup(`new ${name}([`, '])', items)
}

function createArrayItems(value: unknown[], context: NodeContext): ExampleNode[] {
  const proto = Object.getPrototypeOf(value)
  // `Array.prototype` is an array, the prototype of a subclass is not
  if (!Array.isArray(proto)) {
    throw NOT_LITERAL
  }
  const items: ExampleNode[] = []
  let count = 0
  for (let i = 0; i < value.length; i++) {
    // the separator, also of a hole
    reserveWidth(2, context)
    if (Object.hasOwn(value, i)) {
      count++
      items.push(createOwnNode(value, String(i), context))
    } else {
      items.push('')
    }
  }
  // other properties than the items
  if (Reflect.ownKeys(value).length !== count + 1) {
    throw NOT_LITERAL
  }
  return items
}

function createPlainObjectNode(
  value: object,
  nullPrototype: boolean,
  context: NodeContext,
): ExampleNode {
  const entries: [string, ExampleNode][] = []
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      throw NOT_LITERAL
    }
    // the key and `: `
    reserveWidth(key.length + 2, context)
    entries.push([key, createOwnNode(value, key, context)])
  }
  return createExampleObject(entries, nullPrototype)
}

// a getter or a property that is not enumerable has no literal
function createOwnNode(value: object, key: string, context: NodeContext): ExampleNode {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)!
  if (!('value' in descriptor) || !descriptor.enumerable) {
    throw NOT_LITERAL
  }
  return createNode(descriptor.value, context)
}

function createTypedArrayNode(value: object, context: NodeContext): ExampleNode {
  const name: string | undefined = getTypedArrayName.call(value)
  if (!name || !TYPED_ARRAYS.has(name)) {
    throw NOT_LITERAL
  }
  // each item has at least 2 characters, and the own keys of a large typed array are many strings
  assertWidth(2 * getTypedArrayLength.call(value), context)
  const proto = Object.getPrototypeOf(value)
  // the prototype of a subclass has another prototype above the typed array prototype
  if (
    Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(proto))) !== null ||
    Reflect.ownKeys(value).some((key) => typeof key === 'symbol' || !ARRAY_INDEX.test(key))
  ) {
    throw NOT_LITERAL
  }
  const items = Array.from(value as ArrayLike<number | bigint>, (item) =>
    createLeaf(
      typeof item === 'bigint' ? `${item}n` : Object.is(item, -0) ? '-0' : String(item),
      context,
    ),
  )
  return items.length ? createCallNode(name, items) : createLeaf(`new ${name}()`, context)
}
