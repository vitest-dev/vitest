import type { MockedModuleType } from './registry'

type Key = string | symbol

export interface MockObjectOptions {
  type: MockedModuleType
  globalConstructors: GlobalConstructors
  spyOn: (obj: any, prop: Key) => any
}

export function mockObject(
  options: MockObjectOptions,
  object: Record<Key, any>,
  mockExports: Record<Key, any> = {},
): Record<Key, any> {
  const finalizers = new Array<() => void>()
  const refs = new RefTracker()

  const define = (container: Record<Key, any>, key: Key, value: any) => {
    try {
      container[key] = value
      return true
    }
    catch {
      return false
    }
  }

  const mockPropertiesOf = (
    container: Record<Key, any>,
    newContainer: Record<Key, any>,
  ) => {
    const containerType = getType(container)
    const isModule = containerType === 'Module' || !!container.__esModule
    for (const { key: property, descriptor } of getAllMockableProperties(
      container,
      isModule,
      options.globalConstructors,
    )) {
      // Modules define their exports as getters. We want to process those.
      if (!isModule && descriptor.get) {
        try {
          Object.defineProperty(newContainer, property, descriptor)
        }
        catch {
          // Ignore errors, just move on to the next prop.
        }
        continue
      }

      // Skip special read-only props, we don't want to mess with those.
      if (isSpecialProp(property, containerType)) {
        continue
      }

      const value = container[property]

      // Special handling of references we've seen before to prevent infinite
      // recursion in circular objects.
      const refId = refs.getId(value)
      if (refId !== undefined) {
        finalizers.push(() =>
          define(newContainer, property, refs.getMockedValue(refId)),
        )
        continue
      }

      const type = getType(value)

      if (Array.isArray(value)) {
        define(newContainer, property, [])
        continue
      }

      const isFunction
        = type.includes('Function') && typeof value === 'function'
      if (
        (!isFunction || value._isMockFunction)
        && type !== 'Object'
        && type !== 'Module'
      ) {
        define(newContainer, property, value)
        continue
      }

      // Sometimes this assignment fails for some unknown reason. If it does,
      // just move along.
      if (!define(newContainer, property, isFunction ? value : {})) {
        continue
      }

      if (isFunction) {
        if (!options.spyOn) {
          throw new Error(
            '[@vitest/mocker] `spyOn` is not defined. This is a Vitest error. Please open a new issue with reproduction.',
          )
        }
        const spyOn = options.spyOn
        function mockFunction(this: any) {
          // detect constructor call and mock each instance's methods
          // so that mock states between prototype/instances don't affect each other
          // (jest reference https://github.com/jestjs/jest/blob/2c3d2409879952157433de215ae0eee5188a4384/packages/jest-mock/src/index.ts#L678-L691)
          if (this instanceof newContainer[property]) {
            for (const { key, descriptor } of getAllMockableProperties(
              this,
              false,
              options.globalConstructors,
            )) {
              // skip getter since it's not mocked on prototype as well
              if (descriptor.get) {
                continue
              }

              const value = this[key]
              const type = getType(value)
              const isFunction
                = type.includes('Function') && typeof value === 'function'
              if (isFunction) {
                // mock and delegate calls to original prototype method, which should be also mocked already
                const original = this[key]
                const mock = spyOn(this, key as string)
                  .mockImplementation(original)
                const origMockReset = mock.mockReset
                mock.mockRestore = mock.mockReset = () => {
                  origMockReset.call(mock)
                  mock.mockImplementation(original)
                  return mock
                }
              }
            }
          }
        }
        const mock = spyOn(newContainer, property)
        if (options.type === 'automock') {
          mock.mockImplementation(mockFunction)
          const origMockReset = mock.mockReset
          mock.mockRestore = mock.mockReset = () => {
            origMockReset.call(mock)
            mock.mockImplementation(mockFunction)
            return mock
          }
        }
        // tinyspy retains length, but jest doesn't.
        Object.defineProperty(newContainer[property], 'length', { value: 0 })
      }

      refs.track(value, newContainer[property])
      mockPropertiesOf(value, newContainer[property])
    }
  }

  const mockedObject: Record<Key, any> = mockExports
  mockPropertiesOf(object, mockedObject)

  // Plug together refs
  for (const finalizer of finalizers) {
    finalizer()
  }

  return mockedObject
}

class RefTracker {
  private idMap = new Map<any, number>()
  private mockedValueMap = new Map<number, any>()

  public getId(value: any) {
    return this.idMap.get(value)
  }

  public getMockedValue(id: number) {
    return this.mockedValueMap.get(id)
  }

  public track(originalValue: any, mockedValue: any): number {
    const newId = this.idMap.size
    this.idMap.set(originalValue, newId)
    this.mockedValueMap.set(newId, mockedValue)
    return newId
  }
}

function getType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

function isSpecialProp(prop: Key, parentType: string) {
  return (
    parentType.includes('Function')
    && typeof prop === 'string'
    && ['arguments', 'callee', 'caller', 'length', 'name'].includes(prop)
  )
}

export interface GlobalConstructors {
  Object: ObjectConstructor
  Function: FunctionConstructor
  RegExp: RegExpConstructor
  Array: ArrayConstructor
  Map: MapConstructor
}

function getAllMockableProperties(
  obj: any,
  isModule: boolean,
  constructors: GlobalConstructors,
) {
  const { Map, Object, Function, RegExp, Array } = constructors

  const allProps = new Map<
    string | symbol,
    { key: string | symbol; descriptor: PropertyDescriptor }
  >()
  let curr = obj
  do {
    // we don't need properties from these
    if (
      curr === Object.prototype
      || curr === Function.prototype
      || curr === RegExp.prototype
    ) {
      break
    }

    collectOwnProperties(curr, (key) => {
      const descriptor = Object.getOwnPropertyDescriptor(curr, key)
      if (descriptor) {
        allProps.set(key, { key, descriptor })
      }
    })
    // eslint-disable-next-line no-cond-assign
  } while ((curr = Object.getPrototypeOf(curr)))
  // default is not specified in ownKeys, if module is interoped
  if (isModule && !allProps.has('default') && 'default' in obj) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, 'default')
    if (descriptor) {
      allProps.set('default', { key: 'default', descriptor })
    }
  }
  return Array.from(allProps.values())
}

function collectOwnProperties(
  obj: any,
  collector: Set<string | symbol> | ((key: string | symbol) => void),
) {
  const collect
    = typeof collector === 'function'
      ? collector
      : (key: string | symbol) => collector.add(key)
  Object.getOwnPropertyNames(obj).forEach(collect)
  Object.getOwnPropertySymbols(obj).forEach(collect)
}
