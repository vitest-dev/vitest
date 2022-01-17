import { existsSync, readdirSync } from 'fs'
import { isNodeBuiltin } from 'mlly'
import { basename, dirname, join, resolve } from 'pathe'
import { spies, spyOn } from '../integrations/jest-mock'
import { mergeSlashes, normalizeId } from '../utils'

export type SuiteMocks = Record<string, Record<string, string | null | (() => unknown)>>

function resolveMockPath(mockPath: string, root: string, external: string | null) {
  const path = normalizeId(external || mockPath)

  // it's a node_module alias
  // all mocks should be inside <root>/__mocks__
  if (external || isNodeBuiltin(mockPath)) {
    const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
    const baseFilename = basename(path)
    const mockFolder = resolve(root, '__mocks__', mockDirname)

    if (!existsSync(mockFolder)) return null

    const files = readdirSync(mockFolder)

    for (const file of files) {
      const [basename] = file.split('.')
      if (basename === baseFilename)
        return resolve(mockFolder, file).replace(root, '')
    }

    return null
  }

  const dir = dirname(path)
  const baseId = basename(path)
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

function mockObject(obj: any) {
  const type = getObjectType(obj)

  if (Array.isArray(obj))
    return []
  else if (type !== 'Object' && type !== 'Module')
    return obj

  const newObj = { ...obj }

  const proto = mockPrototype(Object.getPrototypeOf(obj))
  Object.setPrototypeOf(newObj, proto)

  // eslint-disable-next-line no-restricted-syntax
  for (const k in obj) {
    newObj[k] = mockObject(obj[k])
    const type = getObjectType(obj[k])

    if (type.includes('Function') && !obj[k].__isSpy) {
      spyOn(newObj, k).mockImplementation(() => {})
      Object.defineProperty(newObj[k], 'length', { value: 0 }) // tinyspy retains length, but jest doesnt
    }
  }
  return newObj
}

export function createMocker(root: string, mockMap: SuiteMocks) {
  function getSuiteFilepath() {
    return process.__vitest_worker__?.filepath || 'global'
  }

  function getMocks() {
    const suite = getSuiteFilepath()
    const suiteMocks = mockMap[suite || '']
    const globalMocks = mockMap.global

    return {
      ...suiteMocks,
      ...globalMocks,
    }
  }

  function getDependencyMock(dep: string) {
    return getMocks()[resolveDependency(dep)]
  }

  function getActualPath(path: string, external: string | null) {
    if (external)
      return mergeSlashes(`/@fs/${path}`)

    return normalizeId(path.replace(root, ''))
  }

  function unmockPath(path: string, external: string | null) {
    const suitefile = getSuiteFilepath()

    const fsPath = getActualPath(path, external)
    mockMap[suitefile] ??= {}
    delete mockMap[suitefile][fsPath]
  }

  function mockPath(path: string, external: string | null, factory?: () => any) {
    const suitefile = getSuiteFilepath()

    const fsPath = getActualPath(path, external)
    mockMap[suitefile] ??= {}
    mockMap[suitefile][fsPath] = factory || resolveMockPath(path, root, external)
  }

  function clearMocks({ clearMocks, mockReset, restoreMocks }: { clearMocks: boolean; mockReset: boolean; restoreMocks: boolean }) {
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

  // npm resolves as /node_modules, but we store as /@fs/.../node_modules
  function resolveDependency(dep: string) {
    if (dep.startsWith('/node_modules/'))
      return mergeSlashes(`/@fs/${join(root, dep)}`)

    return normalizeId(dep)
  }

  return {
    mockPath,
    unmockPath,
    clearMocks,
    getActualPath,
    getMocks,
    getDependencyMock,

    mockObject,
    getSuiteFilepath,
    resolveMockPath,
  }
}
