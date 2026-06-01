import type { Assertion, ExpectPollOptions, PromisifyDomAssertion } from 'vitest'
import type { Locator } from 'vitest/browser'
import type { BrowserTraceEntryStatus } from './trace'
import { chai, expect } from 'vitest'
import { getType } from 'vitest/internal/browser'
import { getBrowserState, getWorkerState, now } from '../utils'
import { ariaMatchers } from './aria'
import { matchers } from './expect'
import { processTimeoutOptions } from './tester-utils'
import { createBrowserTraceRangeId, recordBrowserTraceEntry } from './trace'

const kLocator = Symbol.for('$$vitest:locator')

function element<T extends HTMLElement | SVGElement | null | Locator>(elementOrLocator: T, options?: ExpectPollOptions): PromisifyDomAssertion<HTMLElement | SVGElement | null> {
  if (elementOrLocator != null && !(elementOrLocator instanceof HTMLElement) && !(elementOrLocator instanceof SVGElement) && !(kLocator in elementOrLocator)) {
    throw new Error(`Invalid element or locator: ${elementOrLocator}. Expected an instance of HTMLElement, SVGElement or Locator, received ${getType(elementOrLocator)}`)
  }

  const pollOptions = processTimeoutOptions(options)
  const deadline = pollOptions?.timeout ? now() + pollOptions.timeout : undefined
  const expectElement = expect.poll(async function element(this: object): Promise<HTMLElement | SVGElement | null> {
    if (elementOrLocator instanceof Element || elementOrLocator == null) {
      return elementOrLocator
    }

    const isNot = chai.util.flag(this, 'negate') as boolean
    const name = chai.util.flag(this, '_name') as string
    // special case for `toBeInTheDocument` matcher
    if (isNot && name === 'toBeInTheDocument') {
      return elementOrLocator.query()
    }
    if (name === 'toHaveLength') {
      // we know that `toHaveLength` requires multiple elements,
      // but types generally expect a single one
      return elementOrLocator.elements() as unknown as HTMLElement
    }

    return elementOrLocator.findElement({
      ...pollOptions,
      timeout: deadline ? Math.max(deadline - now(), 0) : undefined,
    })
  }, pollOptions)

  chai.util.flag(expectElement, '_poll.element', true)

  // ask `expect.poll` to invoke trace after the assertion
  const currentTest = getWorkerState().current
  const hasActiveTrace = !!currentTest && getBrowserState().activeTraceTaskIds.has(currentTest.id)
  const hasActiveTraceView = !!currentTest && getBrowserState().browserTraceAttempts.has(currentTest.id)
  if (currentTest && (hasActiveTrace || hasActiveTraceView)) {
    const sourceError = new Error('__vitest_mark_trace__')
    const traceRangeId = hasActiveTraceView ? createBrowserTraceRangeId() : undefined
    const getSelector = () => !elementOrLocator || elementOrLocator instanceof Element
      ? undefined
      : elementOrLocator.serialize()
    const getTraceName = (assertion: Assertion, status?: BrowserTraceEntryStatus) => {
      const isNot = chai.util.flag(assertion, 'negate')
      const name = chai.util.flag(assertion, '_name') || '<unknown>'
      const baseName = `${isNot ? 'not.' : ''}${name}`
      return status === 'fail' ? `${baseName} [ERROR]` : baseName
    }
    chai.util.flag(expectElement, '_poll.onStart', async (meta: { assertion: Assertion }) => {
      if (hasActiveTraceView) {
        await recordBrowserTraceEntry(currentTest, {
          name: getTraceName(meta.assertion),
          kind: 'expect',
          range: { id: traceRangeId!, phase: 'start' },
          element: getSelector(),
          stack: sourceError.stack,
        })
      }
    })
    chai.util.flag(expectElement, '_poll.onSettled', async (meta: { assertion: Assertion; status: BrowserTraceEntryStatus }) => {
      const traceName = getTraceName(meta.assertion, meta.status)
      if (hasActiveTraceView) {
        await recordBrowserTraceEntry(currentTest, {
          name: traceName,
          kind: 'expect',
          range: { id: traceRangeId!, phase: 'end' },
          status: meta.status,
          element: getSelector(),
          stack: sourceError.stack,
        })
      }
      if (hasActiveTrace) {
        await getBrowserState().commands.triggerCommand(
          '__vitest_markTrace',
          [{
            name: traceName,
            element: getSelector(),
            stack: sourceError.stack,
          }],
          sourceError,
        )
      }
    })
  }

  return expectElement
}

expect.extend(matchers)
expect.extend(ariaMatchers)
expect.element = element
