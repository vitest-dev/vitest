import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { page, render } from '~/test'
import DashboardEntry from './DashboardEntry.vue'

const bodyTestId = 'body-content'
const headerTestId = 'header-content'

function div(o: { testId: string; body: string }) {
  return h('div', { 'data-testid': o.testId }, o.body)
}

describe('DashboardEntry', () => {
  it('renders the body and header slots', async () => {
    render(DashboardEntry, {
      slots: {
        body: div({ testId: bodyTestId, body: faker.lorem.words(2) }),
        header: div({ testId: headerTestId, body: faker.hacker.phrase() }),
      },
    })

    await expect.element(page.getByTestId(bodyTestId)).toBeInTheDocument()
    await expect.element(page.getByTestId(headerTestId)).toBeInTheDocument()
  })
})
