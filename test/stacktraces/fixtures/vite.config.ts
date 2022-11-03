import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [{
    name: 'vite-plugin-imba',
    transform(code, id) {
      if (id === 'frame.spec.imba') {
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
            '\n/*body*/\nimport {it,expect} from \'vitest\';\n\nexport function add(...args){\n\t\n\treturn args.reduce(function(a,b) { return a + b; },0);\n};\n\nit("add",function() {\n\t\n\texpect(add()).toBe(0);\n\texpect(add(1)).toBe(3);\n\treturn expect(add(1,2,3)).toBe(6);\n});\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMudGVzdC5pbWJhIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXRpbHMudGVzdC5pbWJhIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aXQsIGV4cGVjdH0gZnJvbSAndml0ZXN0J1xuXG5leHBvcnQgZGVmIGFkZCguLi5hcmdzKVxuXHRyZXR1cm4gYXJncy5yZWR1Y2UoKGRvKGEsIGIpIGEgKyBiKSwgMClcblxuaXQgXCJhZGRcIiwgZG9cblx0ZXhwZWN0KGFkZCgpKS50b0JlIDBcblx0ZXhwZWN0KGFkZCgxKSkudG9CZSAzXG5cdGV4cGVjdChhZGQoMSwgMiwgMykpLnRvQmUgNlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsTUFBTSxFQUFFLEVBQUUsQ0FBRSxNQUFNLE9BQU8sUUFBUTs7QUFFakMsTUFBTSxDQUFDLFFBQUcsQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDOztDQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBRSxRQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsSUFBRSxPQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQztDQUFBOztBQUV4QyxFQUFFLENBQUMsS0FBSyxDQUFFLFFBQUUsR0FBQTs7Q0FDWCxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0NBQ3BCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0NBQ3JCLE9BQUEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtDQUFBLENBSDFCO0FBSUY7In0=',
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
    threads: false,
    isolate: false,
    include: ['**/*.{test,spec}.{imba,js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
})
