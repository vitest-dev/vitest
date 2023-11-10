import { faker } from '@faker-js/faker'
import DashboardEntry from './DashboardEntry.vue'

function body() {
  return <div data-testid="body-content">{ faker.lorem.words(2) }</div>
}
function header() {
  return <div data-testid="header-content">{ faker.hacker.phrase() }</div>
}
const bodySelector = '[data-testid=body-content]'
const headerSelector = '[data-testid=header-content]'
// const tailSelector = '[data-testid=tail]'

describe('DashboardEntry', () => {
  // it('tail is rendered by default', () => {
  //   cy.mount(<DashboardEntry v-slots={{ body, header }}/>)
  //     .get(tailSelector)
  //     .should('exist')
  // })

  // it('tail is not shown when true', () => {
  //   cy.mount(<DashboardEntry tail v-slots={{ body, header }}/>)
  //     .get(tailSelector)
  //     .should('not.exist')
  // })

  it('renders the body and header slots', () => {
    cy.mount(<DashboardEntry v-slots={{ body, header }} />)
      .get(bodySelector)
      .should('be.visible')
      .get(headerSelector)
      .should('be.visible')
  })
})
