import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { render, screen } from '~/test'
import DashboardEntry from './DashboardEntry.vue'

const bodyTestId = 'body-content'
const headerTestId = 'header-content'

function div(o: { testId: string; body: string }) {
  return h('div', { 'data-testid': o.testId }, o.body)
}

describe('DashboardEntry', () => {
  it('renders the body and header slots', () => {
    render(DashboardEntry, {
      slots: {
        body: div({ testId: bodyTestId, body: faker.lorem.words(2) }),
        header: div({ testId: headerTestId, body: faker.hacker.phrase() }),
      },
    })

    expect(screen.getByTestId(bodyTestId)).toBeTruthy()
    expect(screen.getByTestId(headerTestId)).toBeTruthy()
  })
})
