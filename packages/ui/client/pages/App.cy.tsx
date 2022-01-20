import App from './index.vue'

// When mocking WebSockets, we'll want to follow the guide here
// https://glebbahmutov.com/blog/test-socketio-chat-using-cypress/#use-socketio-from-cypress
describe('App', () => {
  it('should render', () => {
    cy.mount(<App />)
  })
})
