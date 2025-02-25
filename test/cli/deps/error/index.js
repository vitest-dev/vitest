import 'node:path'

export function testStack() {
  innerTestStack()
}

import 'node:util'

function innerTestStack() {
  throw new Error('__TEST_STACK__')
}
