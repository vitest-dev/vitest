import { format } from 'util'
import type { File, RunMode, Suite, SuiteAPI, SuiteCollector, SuiteFactory, SuiteHooks, Task, Test, TestAPI, TestFunction } from '../types'
import { isObject, noop, toArray } from '../utils'
import { createChainable } from './chain'
import { collectTask, context, normalizeTest, runWithSuite } from './context'
import { getHooks, setFn, setHooks } from './map'

// apis
export const suite = createSuite()
export const test = createTest(
  function(name: string, fn?: TestFunction, timeout?: number) {
    // @ts-expect-error untyped internal prop
    getCurrentSuite().test.fn.call(this, name, fn, timeout)
  },
)

function formatTitle(template: string, items: any[]) {
  const count = template.split('%').length - 1
  let formatted = format(template, ...items.slice(0, count))
  if (isObject(items[0])) {
    formatted = formatted.replace(/\$([$\w_]+)/g, (_, key) => {
      return items[0][key]
    })
  }
  return formatted
}

// alias
export const describe = suite
export const it = test

// implementations
export const defaultSuite = suite('')

export function clearContext() {
  context.tasks.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}

export function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

export function createSuiteHooks() {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  }
}

function createSuiteCollector(name: string, factory: SuiteFactory = () => { }, mode: RunMode, concurrent?: boolean) {
  const tasks: (Test | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const test = createTest(function(name: string, fn?: TestFunction, timeout?: number) {
    const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'

    const test: Test = {
      id: '',
      type: 'test',
      name,
      mode,
      suite: undefined!,
      fails: this.fails,
    }
    if (this.concurrent || concurrent)
      test.concurrent = true
    setFn(test, normalizeTest(fn || noop, timeout))
    tasks.push(test)
  })

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    test,
    tasks,
    collect,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) {
    getHooks(suite)[name].push(...fn as any)
  }

  function initSuite() {
    suite = {
      id: '',
      type: 'suite',
      name,
      mode,
      tasks: [],
    }
    setHooks(suite, createSuiteHooks())
  }

  function clear() {
    tasks.length = 0
    factoryQueue.length = 0
    initSuite()
  }

  async function collect(file?: File) {
    factoryQueue.length = 0
    if (factory)
      await runWithSuite(collector, () => factory(test))

    const allChildren: Task[] = []

    for (const i of [...factoryQueue, ...tasks])
      allChildren.push(i.type === 'collector' ? await i.collect(file) : i)

    suite.file = file
    suite.tasks = allChildren

    allChildren.forEach((task) => {
      task.suite = suite
      if (file)
        task.file = file
    })

    return suite
  }

  collectTask(collector)

  return collector
}

function createSuite() {
  const suite = createChainable(
    ['concurrent', 'skip', 'only', 'todo'],
    function(name: string, factory?: SuiteFactory) {
      const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
      return createSuiteCollector(name, factory, mode, this.concurrent)
    },
  ) as SuiteAPI

  suite.each = <T>(cases: ReadonlyArray<T>) => {
    return (name: string, fn: (...args: T[]) => void) => {
      cases.forEach((i) => {
        const items = toArray(i) as any
        suite(formatTitle(name, items), () => fn(...items))
      })
    }
  }

  return suite as SuiteAPI
}

function createTest(fn: ((this: Record<'concurrent'| 'skip'| 'only'| 'todo'| 'fails', boolean | undefined>, title: string, fn?: TestFunction, timeout?: number) => void)) {
  const test = createChainable(
    ['concurrent', 'skip', 'only', 'todo', 'fails'],
    fn,
  ) as TestAPI

  test.each = <T>(cases: ReadonlyArray<T>) => {
    return (name: string, fn: (...args: T[]) => void) => {
      cases.forEach((i) => {
        const items = toArray(i) as any
        test(formatTitle(name, items), () => fn(...items))
      })
    }
  }

  return test as TestAPI
}
