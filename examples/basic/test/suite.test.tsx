import { page } from '@vitest/browser/context'
import React, { useEffect, useRef, useState } from 'react'
import { range } from 'remeda'
import { describe, expect, it, vi } from 'vitest'

import { render, waitFor } from '@testing-library/react'

function ScrollableComponent({
  i,
  onScroll,
}: {
  i: number
  onScroll: () => void
}) {
  const [_, setRerender] = useState(false) // force rerender so that the ref gets passed to the hook
  const ref = useRef<HTMLDivElement>(null)
  const scrolledTo = useHasBeenScrolledTo(ref.current)
  useEffect(() => {
    if (scrolledTo) {
      onScroll()
    }
  }, [scrolledTo, onScroll, i])
  useEffect(() => {
    setRerender(true)
  }, [])
  return <div ref={ref}>{`Element${i}`}</div>
}

function TestComponent({ callbacks }: { callbacks: (() => void)[] }) {
  return (
    <>
      {range(0, 100).map(i => (
        <ScrollableComponent i={i} onScroll={callbacks[i]} />
      ))}
    </>
  )
}

async function setup() {
  const callbacks = range(0, 100).map(() => vi.fn())

  render(<TestComponent callbacks={callbacks} />)

  return callbacks
}

/**
 * Return false until the target has is visible on the screen, then return true forever; intended for lazy data fetching.
 */
export default function useHasBeenScrolledTo(target: Element | null) {
  const [hasBeenScrolledTo, setHasBeenScrolledTo] = useState(false)

  useEffect(() => {
    if (!target) {
      return () => {}
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // Once we've seen the thing, we don't need to keep observing it
        setHasBeenScrolledTo(true)
        observer.disconnect()
      }
    })

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [target])

  return hasBeenScrolledTo
}

function isVisibleInViewport(element: Element) {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0
    && rect.left >= 0
    && rect.bottom
    <= (window.innerHeight || document.documentElement.clientHeight)
    && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

describe('useHasBeenScrolledTo', () => {
  function isElementVisible(i: number) {
    return isVisibleInViewport(
      page.getByText(`Element${i}`, { exact: true }).element(),
    )
  }

  async function expectTestBehavior(callbacks: (() => void)[]) {
    let firstElementVisible = isElementVisible(0)
    let lastElementVisible = isElementVisible(99)
    // First element is visible and scrolled to since it's at the top of the page
    expect(firstElementVisible).toBe(true)
    await waitFor(() => {
      expect(vi.mocked(callbacks[0]).mock.calls.length).toBe(1)
    })
    // Last element is not visible or scrolled to
    expect(lastElementVisible).toBe(false)
    expect(vi.mocked(callbacks[99]).mock.calls.length).toBe(0)

    const lastElement = page.getByText('Element99', { exact: true }).element()
    lastElement.scrollIntoView()

    firstElementVisible = isElementVisible(0)
    lastElementVisible = isElementVisible(99)
    // first element is not visible but still scrolled to
    expect(firstElementVisible).toBe(false)
    expect(vi.mocked(callbacks[0]).mock.calls.length).toBe(1)
    // Last element is visible and scrolled to
    expect(lastElementVisible).toBe(true)
    await waitFor(() => {
      expect(vi.mocked(callbacks[99]).mock.calls.length).toBe(1)
    })
  }

  it('fails on the second run', async () => {
    const callbacks = await setup()
    await expectTestBehavior(callbacks)
  })

  it('passes if you manually scroll to the top', async () => {
    const callbacks = await setup()
    const firstElement = page.getByText('Element0', { exact: true }).element()
    firstElement.scrollIntoView()
    await expectTestBehavior(callbacks)
  })
})
