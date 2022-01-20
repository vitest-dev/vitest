import faker from '@faker-js/faker'
// Needed to process uno styles
import 'uno.css'
import 'd3-graph-controller/default.css'
import 'splitpanes/dist/splitpanes.css'
import '@unocss/reset/tailwind.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror-theme-vars/base.css'
import 'tippy.js/dist/tippy.css'
import '../../client/styles/main.css'

import { registerMount } from './mount'

before(() => {
  faker.seed(0)
})

registerMount()
