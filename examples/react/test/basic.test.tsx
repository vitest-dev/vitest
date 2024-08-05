import { assert, expect, test } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { LINK_STATUS, Link, useLinkState } from '../components/Link.jsx'

test('Link changes the state when hovered', async () => {
  render(
    <Link page="http://antfu.me">Anthony Fu</Link>,
  )

  const link = screen.getByText('Anthony Fu')

  expect(link).toHaveAccessibleName('Link is normal')

  await userEvent.hover(link)

  expect(link).toHaveAccessibleName('Link is hovered')

  await userEvent.unhover(link)

  expect(link).toHaveAccessibleName('Link is normal')
})

test('useLinkState updates result', async () => {
  const { result } = renderHook(() => useLinkState())

  let [status, handlers] = result.current

  assert(status === LINK_STATUS.NORMAL)
  assert(handlers.onMouseEnter)
  assert(handlers.onMouseLeave)

  act(() => {
    handlers.onMouseEnter()
  })

  ;[status, handlers] = result.current

  assert(
    status === LINK_STATUS.HOVERED,
    `status is ${status}, but should be ${LINK_STATUS.HOVERED}`,
  )
})
