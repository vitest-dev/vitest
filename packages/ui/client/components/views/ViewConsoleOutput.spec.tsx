import ViewConsoleOutput from './ViewConsoleOutput.vue'

const entrySelector = '[data-testid=logs]'

describe('ViewConsoleOutput', () => {
  it('renders', () => {
    cy.mount(<ViewConsoleOutput/>)
      .get(entrySelector)
      // TODO: stub the websocket connection
      // so that we can add logs and other data
      .should('not.exist')
  })
})
