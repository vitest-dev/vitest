import type { MockedModule } from '@vitest/mocker'
import type { ModuleMockerInterceptor } from '@vitest/mocker/browser'
import type { MockImportMap } from '../../types'
import type { BrowserRPC } from '../client'
import { relative } from 'pathe'
import { getBrowserState, getConfig, getWorkerState } from '../utils'

interface PageMock {
  importer: string
  type: MockedModule['type']
  // the test file that was running when the page fetched the mock
  loadedBy?: string
}

// the page keeps one instance per module URL, so test files that share a page
// also share every module and mock that the page already evaluated
const pageMocks = new Map<string, PageMock>()
// module URL -> the test file that was running when the page fetched it
const pageLoads = new Map<string, string>()
// a mock that the page fetches from another URL, like an import map target
const mockTargets = new Map<string, string>()
const fileMocks = new Set<string>()
const fileUnmocks = new Set<string>()
let currentFile: string | undefined

const loads = new PerformanceObserver((list) => recordLoads(list.getEntries()))
loads.observe({ type: 'resource', buffered: true })

export function onTestFileStart(file: string): void {
  flushLoads()
  // a mock that the page never fetched is gone with the registry of its file
  for (const [url, mock] of pageMocks) {
    if (mock.loadedBy === undefined) {
      pageMocks.delete(url)
    }
  }
  fileMocks.clear()
  fileUnmocks.clear()
  currentFile = file
}

export function createModuleMockerInterceptor(): ModuleMockerInterceptor {
  return {
    async register(module, importer) {
      flushLoads()
      const url = normalizeModuleUrl(module.url)
      if (url) {
        assertCanMock(url, module, importer)
        fileMocks.add(url)
        fileUnmocks.delete(url)
      }
      const { sessionId } = getBrowserState()
      const importMap = await rpc().registerMock(sessionId, module.toJSON(), {
        importer,
        testFile: getWorkerState().filepath,
      })
      if (importMap) {
        for (const [specifier, target] of Object.entries(importMap.imports)) {
          const moduleUrl = normalizeModuleUrl(specifier)
          const targetUrl = normalizeModuleUrl(target)
          if (moduleUrl && targetUrl && targetUrl !== moduleUrl) {
            mockTargets.set(targetUrl, moduleUrl)
          }
        }
        appendImportMap(importMap)
      }
    },
    async delete(id) {
      const url = normalizeModuleUrl(id)
      if (url) {
        fileMocks.delete(url)
        fileUnmocks.add(url)
        if (pageMocks.get(url)?.loadedBy === undefined) {
          pageMocks.delete(url)
        }
      }
      const state = getBrowserState()
      await rpc().unregisterMock(state.sessionId, id)
    },
    async invalidate() {
      const state = getBrowserState()
      await rpc().clearMocks(state.sessionId)
    },
  }
}

// a file that shares the page with earlier files gets their mocks from the
// modules that it evaluates, which Node.js resolves against its own mocks instead
export async function assertNoMockConflicts(importpath: string): Promise<void> {
  flushLoads()
  const mocked: string[] = []
  for (const [url, mock] of pageMocks) {
    if (mock.loadedBy !== undefined && !fileMocks.has(url)) {
      mocked.push(url)
    }
  }
  if (!mocked.length) {
    return
  }
  const imports = await rpc().getMockedImports(importpath, mocked)
  const entry = normalizeModuleUrl(importpath)
  for (const { importer, specifier } of imports) {
    const url = normalizeModuleUrl(specifier)
    const mock = url && pageMocks.get(url)
    if (!url || !mock || mock.loadedBy === undefined || fileMocks.has(url)) {
      continue
    }
    const importerUrl = normalizeModuleUrl(importer)
    // a module that an earlier file evaluated keeps the mock in Node.js as well
    if (!importerUrl || (importerUrl !== entry && pageLoads.get(importerUrl) !== currentFile)) {
      continue
    }
    const reason = `"${displayPath(importerUrl)}" imports "${url}", which ${describeMockLoad(mock, '')}.`
    throw new Error(
      `${
        fileUnmocks.has(url) ? `vi.unmock("${url}") has no effect: ${reason}` : reason
      } The mocked module stays in the page when "isolate" is false. ` +
        `Mock "${url}" in this file too, or run the files that need the original in an isolated project.`,
    )
  }
}

function assertCanMock(url: string, module: MockedModule, importer: string) {
  const mock = pageMocks.get(url)
  if (mock?.loadedBy !== undefined) {
    // the same mock again, usually from a setup file: the page keeps the first instance
    if (mock.importer === importer && mock.type === module.type) {
      return
    }
    throw new Error(
      `Cannot mock "${url}": ${describeMockLoad(mock, ' it')}. ${sharedPageHint(url)}`,
    )
  }
  const file = pageLoads.get(url)
  if (file === undefined) {
    pageMocks.set(url, { importer, type: module.type })
    return
  }
  if (file === currentFile) {
    throw new Error(
      `Cannot mock "${url}": the page already imported it before vi.mock was registered, ` +
        `for example by a setup file or by an earlier dynamic import. ` +
        `A module cannot be evaluated again in the browser.`,
    )
  }
  throw new Error(
    `Cannot mock "${url}": the page already imported it while running "${displayPath(file)}". ${sharedPageHint(url)}`,
  )
}

function describeMockLoad(mock: PageMock, object: '' | ' it') {
  const file = displayPath(mock.loadedBy!)
  const importer = displayPath(mock.importer)
  return importer === file
    ? `the page already imported${object} as a mock while running "${file}"`
    : `the page already imported${object} as the mock from "${importer}" while running "${file}"`
}

function sharedPageHint(url: string) {
  return (
    `Test files share the page when "isolate" is false, and a module cannot be evaluated again. ` +
    `Mock "${url}" the same way in a setup file, or run the files that mock it in an isolated project.`
  )
}

function flushLoads() {
  recordLoads(loads.takeRecords())
}

function recordLoads(entries: PerformanceEntryList) {
  for (const entry of entries) {
    const url = normalizeModuleUrl(entry.name)
    if (!url) {
      continue
    }
    const moduleUrl = mockTargets.get(url) ?? url
    if (pageLoads.has(moduleUrl)) {
      continue
    }
    const file = currentFile ?? ''
    pageLoads.set(moduleUrl, file)
    const mock = pageMocks.get(moduleUrl)
    if (mock) {
      mock.loadedBy = file
    }
  }
}

// the mocker, the import map and the server identify a module by its URL
// without the dependency version, the HMR timestamp, the test run and the Vite base
function normalizeModuleUrl(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw, location.href)
  } catch {
    return
  }
  if (url.origin !== location.origin || url.searchParams.has('_vitest_original')) {
    return
  }
  for (const query of ['v', 't', 'import', 'browserv']) {
    url.searchParams.delete(query)
  }
  let pathname = url.pathname
  const base = getBrowserState().viteConfig.base
  if (base && base !== '/' && pathname.startsWith(base)) {
    pathname = pathname.slice(base.length - 1)
  }
  return pathname + url.search
}

function displayPath(path: string) {
  const root = getConfig().root
  path = path.replace(/[?&]browserv=\w+/, '')
  if (path.startsWith('/@fs/')) {
    path = path.slice(/^\/@fs\/[a-zA-Z]:\//.test(path) ? 5 : 4)
  }
  if (path.startsWith(`${root}/`)) {
    return relative(root, path)
  }
  return path.replace(/^\//, '')
}

// the browser drops a rule for a module that the document already resolved
// and only prints a console warning, so check that every rule took effect
function appendImportMap(importMap: MockImportMap) {
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify(importMap)
  document.head.append(script)
  for (const [specifier, url] of Object.entries(importMap.imports)) {
    const expected = new URL(url, location.href).href
    if (import.meta.resolve(specifier) !== expected) {
      throw new Error(
        `Cannot mock "${specifier}" with an import map because the browser kept its original URL. ` +
          `The module was already imported before vi.mock was registered, ` +
          `for example by a setup file or by an earlier test file when "isolate" is false.`,
      )
    }
  }
}

function rpc(): BrowserRPC {
  return getWorkerState().rpc as any as BrowserRPC
}
