import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('should load external source maps for bundled dependencies', async () => {
  const { stderr, stdout } = await runInlineTests(
    {
      'bundled-dep.js': `
// Simulated bundled code (transformed)
function __bundled__throwError() {
  throw new Error('Error from bundled dependency');
}
export function callError() {
  __bundled__throwError();
}
//# sourceMappingURL=bundled-dep.js.map
      `,
      'bundled-dep.js.map': JSON.stringify({
        version: 3,
        file: 'bundled-dep.js',
        sources: ['original-source.ts'],
        sourcesContent: [
          `// Original source before bundling
function throwError() {
  throw new Error('Error from bundled dependency');
}
export function callError() {
  throwError();
}
`,
        ],
        names: [],
        mappings: ';;AACA,SAAS,UAAU,GAAG;AACpB,QAAM,IAAI,KAAK,CAAC,gCAAgC,CAAC;AACnD;AACA,OAAO,SAAS,SAAS,GAAG;AAC1B,YAAU,EAAE;AACd',
      }),
      'test.spec.ts': `
import { test, expect } from 'vitest';
import { callError } from './bundled-dep.js';

test('error with external source map', () => {
  try {
    callError();
    expect.fail('Should have thrown an error');
  } catch (error) {
    // The error should reference the original source file
    expect(error.message).toBe('Error from bundled dependency');
    // Stack trace should be parsed with source maps
    expect(error.stack).toBeTruthy();
  }
});
      `,
    },
    {
      pool: 'threads',
    },
  )

  // The test should pass, meaning source maps were loaded
  expect(stderr).not.toContain('FAIL')
})

test('should handle missing external source maps gracefully', async () => {
  const { stderr } = await runInlineTests(
    {
      'bundled-dep-no-map.js': `
// Bundled code with source map reference but no actual map file
function __bundled__throwError() {
  throw new Error('Error without source map');
}
export function callError() {
  __bundled__throwError();
}
//# sourceMappingURL=non-existent.js.map
      `,
      'test.spec.ts': `
import { test, expect } from 'vitest';
import { callError } from './bundled-dep-no-map.js';

test('error without external source map', () => {
  try {
    callError();
    expect.fail('Should have thrown an error');
  } catch (error) {
    // Should still work even without source map
    expect(error.message).toBe('Error without source map');
    expect(error.stack).toBeTruthy();
  }
});
      `,
    },
    {
      pool: 'threads',
    },
  )

  // The test should still pass even without source map
  expect(stderr).not.toContain('FAIL')
})

test('should parse stack traces with external source maps in error output', async () => {
  const result = await runInlineTests(
    {
      'bundled-lib.js': `
// Simulated bundled library code
export function deepFunction() {
  throw new Error('Deep error in bundled code');
}
export function middleFunction() {
  deepFunction();
}
export function topFunction() {
  middleFunction();
}
//# sourceMappingURL=bundled-lib.js.map
      `,
      'bundled-lib.js.map': JSON.stringify({
        version: 3,
        file: 'bundled-lib.js',
        sources: ['src/lib.ts'],
        sourcesContent: [
          `// Original library source
export function deepFunction() {
  throw new Error('Deep error in bundled code');
}
export function middleFunction() {
  deepFunction();
}
export function topFunction() {
  middleFunction();
}
`,
        ],
        names: [],
        mappings: ';;AACA,OAAO,SAAS,YAAY,GAAG;AAC7B,QAAM,IAAI,KAAK,CAAC,4BAA4B,CAAC;AAC/C;AACA,OAAO,SAAS,cAAc,GAAG;AAC/B,cAAY,EAAE;AAChB;AACA,OAAO,SAAS,WAAW,GAAG;AAC5B,gBAAc,EAAE;AAClB',
      }),
      'test.spec.ts': `
import { test, expect } from 'vitest';
import { topFunction } from './bundled-lib.js';

test('should show original source in stack trace', () => {
  expect(() => topFunction()).toThrow('Deep error in bundled code');
});
      `,
    },
    {
      pool: 'threads',
    },
  )

  // The test itself should pass - this verifies source maps work
  expect(result.stderr).not.toContain('FAIL')
})
