import { existsSync, readdirSync } from 'fs'
import { basename, dirname, resolve } from 'pathe'
import { spies, spyOn } from '../integrations/jest-mock'
import { mergeSlashes } from '../utils'

export interface SuiteMocks {
  [suitePath: string]: {
    [originalPath: string]: string | null | (() => any)
  }
}

function resolveMockPath(mockPath: string, root: string, nmName: string | null) {
  // it's a node_module alias
  // all mocks should be inside <root>/__mocks__
  if (nmName) {
    const mockFolder = resolve(root, '__mocks__')

    if (!existsSync(mockFolder)) return null

    const files = readdirSync(mockFolder)

    for (const file of files) {
      const [basename] = file.split('.')
      if (basename === nmName)
        return resolve(mockFolder, file).replace(root, '')
    }

    return null
  }

  const dir = dirname(mockPath)
  const baseId = basename(mockPath)
  const fullPath = resolve(dir, '__mocks__', baseId)
  return existsSync(fullPath) ? fullPath.replace(root, '') : null
}

function getObjectType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

function mockPrototype(proto: any) {
  if (!proto) return null

  const newProto: any = {}

  const protoDescr = Object.getOwnPropertyDescriptors(proto)

  // eslint-disable-next-line no-restricted-syntax
  for (const d in protoDescr) {
    Object.defineProperty(newProto, d, protoDescr[d])

    if (typeof protoDescr[d].value === 'function')
      spyOn(newProto, d).mockImplementation(() => {})
  }

  return newProto
}

function mockObject(obj: any, seen = new WeakSet()) {
  if (seen.has(obj))
    return obj

  if (Array.isArray(obj))
    return []

  const objectType = getObjectType(obj)

  if (objectType !== 'Object' && objectType !== 'Module' && objectType !== 'Function')
    return obj

  seen.add(obj)

  const newObj = { ...obj }

  const proto = mockPrototype(Object.getPrototypeOf(obj))
  Object.setPrototypeOf(newObj, proto)

  // eslint-disable-next-line no-restricted-syntax
  for (const objAttr in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, objAttr)) continue

    const objValue = obj[objAttr]
    const nestedObjectType = getObjectType(objValue)

    if (nestedObjectType === 'Function') {
      // ex: function foo() {}
      // foo.newFunction = () => {}
      const hasFunctionsAttr = Object.keys(objValue).length !== 0

      if (hasFunctionsAttr) {
        newObj[objAttr] = mockObject(objValue, seen)
      }
      else if (!objValue.__isSpy) {
        spyOn(newObj, objAttr).mockImplementation(() => {})
        Object.defineProperty(objValue, 'length', { value: 0 }) // tinyspy retains length, but jest doesnt
      }
    }
    else {
      newObj[objAttr] = mockObject(objValue, seen)
    }
  }

  return newObj
}

export function createMocker(root: string, mockMap: SuiteMocks) {
  function getSuiteFilepath() {
    return process.__vitest_worker__?.filepath
  }

  function getActualPath(path: string, nmName: string) {
    return nmName ? mergeSlashes(`/@fs/${path}`) : path.replace(root, '')
  }

  function unmockPath(path: string, nmName: string) {
    const suitefile = getSuiteFilepath()

    if (suitefile) {
      const fsPath = getActualPath(path, nmName)
      mockMap[suitefile] ??= {}
      delete mockMap[suitefile][fsPath]
    }
  }

  function mockPath(path: string, nmName: string, factory?: () => any) {
    const suitefile = getSuiteFilepath()

    if (suitefile) {
      const fsPath = getActualPath(path, nmName)
      mockMap[suitefile] ??= {}
      mockMap[suitefile][fsPath] = factory || resolveMockPath(path, root, nmName)
    }
  }

  function clearMocks({ clearMocks, mockReset, restoreMocks }: { clearMocks: boolean; mockReset: boolean; restoreMocks: boolean}) {
    if (!clearMocks && !mockReset && !restoreMocks)
      return

    spies.forEach((s) => {
      if (restoreMocks)
        s.mockRestore()
      else if (mockReset)
        s.mockReset()
      else if (clearMocks)
        s.mockClear()
    })
  }

  return {
    mockPath,
    unmockPath,
    clearMocks,
    getActualPath,

    mockObject,
    getSuiteFilepath,
    resolveMockPath,
  }
}
