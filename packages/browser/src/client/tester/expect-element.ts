import type { Assertion, ExpectPollOptions, PromisifyDomAssertion } from 'vitest'
import type { Locator } from 'vitest/browser'
import type { BrowserTraceEntryStatus } from './trace'
import { chai, expect } from 'vitest'
import { getType } from 'vitest/internal/browser'
import { getBrowserState, getWorkerState, now } from '../utils'
import { ariaMatchers } from './aria'
import { matchers } from './expect'
import { processTimeoutOptions } from './tester-utils'
import { recordBrowserTraceEntry } from './trace'

const kLocator = Symbol.for('$$vitest:locator')

function element<T extends HTMLElement | SVGElement | null | Locator>(elementOrLocator: T, options?: ExpectPollOptions): PromisifyDomAssertion<HTMLElement | SVGElement | null> {
  if (elementOrLocator != null && !(elementOrLocator instanceof HTMLElement) && !(elementOrLocator instanceof SVGElement) && !(kLocator in elementOrLocator)) {
    throw new Error(`Invalid element or locator: ${elementOrLocator}. Expected an instance of HTMLElement, SVGElement or Locator, received ${getType(elementOrLocator)}`)
  }

  const pollOptions = processTimeoutOptions(options)
  const deadline = pollOptions?.timeout ? now() + pollOptions.timeout : undefined
  const expectElement = expect.poll(function element(this: object) {
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
    const startTime = now()
    chai.util.flag(expectElement, '_poll.onSettled', async (meta: { assertion: Assertion; status: BrowserTraceEntryStatus }) => {
      const isNot = chai.util.flag(meta.assertion, 'negate')
      const name = chai.util.flag(meta.assertion, '_name') || '<unknown>'
      const baseName = `${isNot ? 'not.' : ''}${name}`
      const traceName = meta.status === 'fail' ? `${baseName} [ERROR]` : baseName
      const selector = !elementOrLocator || elementOrLocator instanceof Element
        ? undefined
        : elementOrLocator.serialize()
      if (hasActiveTraceView) {
        recordBrowserTraceEntry(currentTest, {
          name: traceName,
          kind: 'expect',
          status: meta.status,
          startTime,
          duration: now() - startTime,
          element: selector,
          stack: sourceError.stack,
        })
      }
      if (hasActiveTrace) {
        await getBrowserState().commands.triggerCommand(
          '__vitest_markTrace',
          [{
            name: traceName,
            element: selector,
            stack: sourceError.stack,
          }],
          sourceError,
        )
      }
    })
  }

  return expectElement as any
}

expect.extend(matchers)
expect.extend(ariaMatchers)
expect.element = element
