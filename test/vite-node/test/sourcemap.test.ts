import type { SourceMap } from 'rollup'
/* eslint-disable no-template-curly-in-string */
import type { TransformResult } from 'vite'
import { describe, expect, it } from 'vitest'
import { withInlineSourcemap } from '../../../packages/vite-node/src/source-map'

it('regex match', () => {
  const regex = /\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,[A-Za-z0-9+/=]+$/gm
  expect('function foo(src) {\n  return `//# sourceMappingURL=data:application/json;base64,${src}`;\n}\nObject.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});\n'.match(regex)).toBeNull()
  expect(`function foo(src) {
    return \`//# sourceMappingURL=data:application/json;base64,\${src}\`;
  }
  Object.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});

  //# sourceMappingSource=vite-node
  //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ==`.match(regex)).deep.eq(['//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ=='])
  expect(`function foo(src) {
    return \`//# sourceMappingURL=data:application/json;base64,\${src}\`;
  }
  Object.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});

  //# sourceMappingSource=vite-node
  //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ==`.replace(regex, '')).not.include('//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ==')
})

describe('withInlineSourcemap', () => {
  const input: TransformResult = {
    code: 'function foo(src) {\n  return `//# sourceMappingURL=data:application/json;base64,${src}`;\n}\nObject.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});\n',
    map: {
      version: 3,
      mappings: 'AAAO,SAAS,IAAI,KAAqB;AACvC,SAAO,qDAAqD;AAC9D;iHAAA',
      names: [],
      sourceRoot: undefined,
      sources: [
        '/foo.ts',
      ],
      sourcesContent: [
        'export function foo(src: string): string {\n  return `//# sourceMappingURL=data:application/json;base64,${src}`\n}\n',
      ],
      file: '/src/foo.ts',
    } as unknown as SourceMap,
    deps: [
    ],
    dynamicDeps: [
    ],
  }
  const options = {
    root: '/',
    filepath: '/foo.ts',
  }

  it('Check that the original sourcemap in the string is not removed', () => {
    expect(withInlineSourcemap(input, options).code).contain('return `//# sourceMappingURL=data:application/json;base64,${src}`')
  })
  it('Check that the appended sourcemap is removed', () => {
    input.code = `function foo(src) {
      return \`//# sourceMappingURL=data:application/json;base64,\${src}\`;
    }
    Object.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});

    //# sourceMappingSource=other
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udtest==`

    expect(withInlineSourcemap(input, options).code).not.toContain('//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udtest==')
  })
  it('Check that the vite-node sourcemap isnot removed', () => {
    input.code = `function foo(src) {
      return \`//# sourceMappingURL=data:application/json;base64,\${src}\`;
    }
    Object.defineProperty(__vite_ssr_exports__, "foo", { enumerable: true, configurable: true, get(){ return foo }});

    //# sourceMappingSource=vite-node
    //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ==`

    expect(withInlineSourcemap(input, options).code).include('//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQU8sU0FBUyxJQUFJLEtBQXFCO0FBQ3ZDLFNBQU8scURBQXFEO0FBQzlEO2lIQUFBIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL2Zvby50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZm9vKHNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7c3JjfWBcbn1cbiJdLCJmaWxlIjoiL3NyYy9mb28udHMifQ==')
  })
  it('Check that the vite-node in real code', () => {
    input.code = `
import { expect, it } from 'vitest'

it('should have sourcemaps', () => {
  expect('\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9==').toBeTruthy()
  expect("\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9==").toBeTruthy()
  expect(\`\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9==\`).toBeTruthy()
})
    `
    expect(withInlineSourcemap(input, options).code)
      .include('\'\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9==\'')
      .include('"\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9=="')
      .include('`\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9==`')
  })
})
