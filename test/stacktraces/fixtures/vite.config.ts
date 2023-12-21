import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [{
    name: 'vite-plugin-imba',
    transform(code, id) {
      if (id.endsWith('frame.spec.imba')) {
        // eslint-disable-next-line no-throw-literal
        throw {
          name: 'imba-parser error',
          id,
          message: 'Unexpected \'CALL_END\'',
          code,
          frame:
              '4 | test("1+1") do\n5 |  expect(1+1).toBe 2\n6 |  frame.\n  |        ^\n7 |\n',
          loc: {
            line: 3,
            column: 11,
            file: id,
          },
        }
      }
      if (id.endsWith('.imba')) {
        return {
          code:
            '\n/*body*/\nimport {it,expect} from \'vitest\';\n\nexport function add(...args){\n\t\n\treturn args.reduce(function(a,b) { return a + b; },0);\n};\n\nit("add",function() {\n\t\n\texpect(add()).toBe(0);\n\texpect(add(1)).toBe(3);\n\treturn expect(add(1,2,3)).toBe(6);\n});',
          map: {
            version: 3,
            file: 'add-in-imba.test.imba',
            names: [],
            sourceRoot: '',
            sources: ['add-in-imba.test.imba'],
            sourcesContent: [
              'import {it, expect} from \'vitest\'\n\nexport def add(...args)\n\treturn args.reduce((do(a, b) a + b), 0)\n\nit "add", do\n\texpect(add()).toBe 0\n\texpect(add(1)).toBe 3\n\texpect(add(1, 2, 3)).toBe 6\n',
            ],
            mappings:
              ';;AAAA,MAAM,EAAE,EAAE,CAAE,MAAM,OAAO,QAAQ;;AAEjC,MAAM,CAAC,QAAG,CAAC,GAAG,IAAI,IAAI,CAAC;;CACtB,MAAM,CAAC,IAAI,CAAC,MAAM,CAAE,QAAE,CAAC,CAAC,CAAE,CAAC,IAAE,OAAA,CAAC,CAAC,CAAC,CAAC,CAAC,IAAG,CAAC,CAAC;CAAA;;AAExC,EAAE,CAAC,KAAK,CAAE,QAAE,GAAA;;CACX,MAAM,CAAC,GAAG,EAAE,CAAC,CAAC,IAAI,CAAC,CAAC,CAAA;CACpB,MAAM,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAA;CACrB,OAAA,MAAM,CAAC,GAAG,CAAC,CAAC,CAAE,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAA;CAAA,CAH1B;AAIF;',
          },
        }
      }
    },
  }],
  test: {
    isolate: false,
    pool: 'forks',
    include: ['**/*.{test,spec}.{imba,?(c|m)[jt]s?(x)}'],
    setupFiles: ['./setup.js'],
  },
})
