import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import React from 'react'
import { expect, test } from 'vitest'
import Link from '../components/Link.jsx'

test('Link changes the state when hovered', async () => {
  render(
    <Link page="http://antfu.me">Anthony Fu</Link>,
  )

  const link = screen.getByText('Anthony Fu')

  expect(link).toHaveAccessibleName('Link is normal')

  await userEvent.hover(link)

  await expect.poll(() => link).toHaveAccessibleName('Link is hovered')

  await userEvent.unhover(link)

  await expect.poll(() => link).toHaveAccessibleName('Link is normal')
})
