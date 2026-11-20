// Tests can spy on these globals, and mocks call them internally.
// `Promise` is not here because zone.js replaces it after Vitest loads.

const { bind, call } = Function.prototype
const uncurryThis: <T, A extends any[], R>(
  fn: (this: T, ...args: A) => R,
) => (self: T, ...args: A) => R = bind.bind(call)

export const ReflectApply: typeof Reflect.apply = Reflect.apply
export const ReflectConstruct: typeof Reflect.construct = Reflect.construct
export const ReflectDeleteProperty: typeof Reflect.deleteProperty = Reflect.deleteProperty
export const ReflectOwnKeys: typeof Reflect.ownKeys = Reflect.ownKeys

export const ObjectDefineProperty: typeof Object.defineProperty = Object.defineProperty
export const ObjectGetOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor =
  Object.getOwnPropertyDescriptor
export const ObjectGetPrototypeOf: typeof Object.getPrototypeOf = Object.getPrototypeOf
export const ObjectSetPrototypeOf: typeof Object.setPrototypeOf = Object.setPrototypeOf

export const WeakRef: WeakRefConstructor = globalThis.WeakRef

export const ArrayPrototypeAt: <T>(array: T[], index: number) => T | undefined = uncurryThis(
  Array.prototype.at,
)
export const ArrayPrototypePush: <T>(array: T[], ...items: T[]) => number = uncurryThis(
  Array.prototype.push,
)
export const ArrayPrototypeShift: <T>(array: T[]) => T | undefined = uncurryThis(
  Array.prototype.shift,
)

export const SetPrototypeAdd: <T>(set: Set<T>, value: T) => Set<T> = uncurryThis(Set.prototype.add)
export const SetPrototypeClear: <T>(set: Set<T>) => void = uncurryThis(Set.prototype.clear)
export const SetPrototypeDelete: <T>(set: Set<T>, value: T) => boolean = uncurryThis(
  Set.prototype.delete,
)
export const SetPrototypeHas: <T>(set: Set<T>, value: T) => boolean = uncurryThis(Set.prototype.has)

export const WeakMapPrototypeGet: <K extends WeakKey, V>(
  map: WeakMap<K, V>,
  key: K,
) => V | undefined = uncurryThis(WeakMap.prototype.get)
export const WeakMapPrototypeSet: <K extends WeakKey, V>(
  map: WeakMap<K, V>,
  key: K,
  value: V,
) => void = uncurryThis(WeakMap.prototype.set)

export const WeakRefPrototypeDeref: <T extends WeakKey>(ref: WeakRef<T>) => T | undefined =
  uncurryThis(WeakRef.prototype.deref)

export const FinalizationRegistryPrototypeRegister: <T>(
  registry: FinalizationRegistry<T>,
  target: WeakKey,
  heldValue: T,
) => void = uncurryThis(FinalizationRegistry.prototype.register)

export const StringPrototypeIncludes: (string: string, searchString: string) => boolean =
  uncurryThis(String.prototype.includes)
