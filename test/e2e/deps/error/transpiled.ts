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
  throw new Error('__TEST_STACK_TRANSPILED__')
}

// transpiled.js and transpiled.js.map are copied from
// https://esbuild.github.io/try/#dAAwLjI1LjAALS1sb2FkZXI9dHMgLS1zb3VyY2VtYXAgLS1zb3VyY2VmaWxlPXRyYW5zcGlsZWQudHMAaW1wb3J0ICdub2RlOnBhdGgnCgpleHBvcnQgdHlwZSBEdW1teSA9IHsKICBmb286ICJmb28iLAp9CgovKioKICogZHVtbXkKICogZHVtbXkKICovCmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHRlc3RTdGFjaygpIHsKICBpbm5lclRlc3RTdGFjaygpCn0KCmltcG9ydCAnbm9kZTp1dGlsJwoKLyoqCiAqIGJhcgogKiBiYXIKICovCmZ1bmN0aW9uIGlubmVyVGVzdFN0YWNrKCkgewogIHRocm93IG5ldyBFcnJvcignX19URVNUX1NUQUNLX1RSQU5TUElMRURfXycpCn0
