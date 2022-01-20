import IconButton from './IconButton.vue'

const title = 'A star'
const icon = 'i-carbon-star-filled'

describe('IconButton', () => {
  it('should render the title', () => {
    cy.mount(<IconButton m="2" title={title} icon={icon}/>)
      .get(`[aria-label="${title}"][role=button]`)
      .should('be.visible')
  })

  it('can be overridden with a slot', () => {
    cy.mount(<IconButton m="2" icon={icon}>
      <span text="32px">⭐️</span>
    </IconButton>)
      .get(`.${icon}`)
      .should('not.exist')
      .get('button')
      .contains('⭐️')
      .should('be.visible')
  })
})
