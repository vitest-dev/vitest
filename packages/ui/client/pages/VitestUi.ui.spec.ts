import { mount } from '@cypress/vue'
import App from './index.vue'
describe('App', () => {
  it('should render', () => {
    mount(App)
  })
})
