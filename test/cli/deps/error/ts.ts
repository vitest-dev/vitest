import 'node:path'

export type Dummy = {
  foo: "foo",
}

/**
 * dummy
 * dummy
 */
export default function testStack() {
  innerTestStack()
}

import 'node:util'

/**
 * bar
 * bar
 */
function innerTestStack() {
  throw new Error('__TEST_STACK_TS__')
}
