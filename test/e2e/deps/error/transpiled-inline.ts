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
  throw new Error('__TEST_STACK_TRANSPILED_INLINE__')
}

// transpiled-inline.js is copied from
// https://esbuild.github.io/try/#dAAwLjI1LjAALS1sb2FkZXI9dHMgLS1zb3VyY2VtYXA9aW5saW5lIC0tc291cmNlZmlsZT10cmFuc3BpbGVkLWlubGluZS50cwBpbXBvcnQgJ25vZGU6cGF0aCcKCmV4cG9ydCB0eXBlIER1bW15ID0gewogIGZvbzogImZvbyIsCn0KCi8qKgogKiBkdW1teQogKiBkdW1teQogKi8KZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdGVzdFN0YWNrKCkgewogIGlubmVyVGVzdFN0YWNrKCkKfQoKaW1wb3J0ICdub2RlOnV0aWwnCgovKioKICogYmFyCiAqIGJhcgogKi8KZnVuY3Rpb24gaW5uZXJUZXN0U3RhY2soKSB7CiAgdGhyb3cgbmV3IEVycm9yKCdfX1RFU1RfU1RBQ0tfVFJBTlNQSUxFRF9JTkxJTkVfXycpCn0
