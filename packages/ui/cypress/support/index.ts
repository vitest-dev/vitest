import faker from '@faker-js/faker'
import '@testing-library/cypress/add-commands'
import '../../client/global-setup'

import { registerMount } from './mount'

before(() => {
  faker.seed(0)
})

registerMount()
