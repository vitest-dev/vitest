# @vitest/expect

Jest's expect matchers as a Chai plugin.

## Usage

```js
import * as chai from 'chai'
import {
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
} from '@vitest/expect'

// allows using expect.extend instead of chai.use to extend plugins
chai.use(JestExtend)
// adds all jest matchers to expect
chai.use(JestChaiExpect)
// adds asymmetric matchers like stringContaining, objectContaining
chai.use(JestAsymmetricMatchers)
```
