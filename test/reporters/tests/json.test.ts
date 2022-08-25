import { afterEach, expect, test, vi } from 'vitest'
import { JsonReporter } from 'vitest/src/node/reporters/json'
import type { ModuleGraph, ModuleNode, TransformResult } from 'vite'
import { getContext } from '../src/context'
import { clearSourcePos, files } from '../src/data'

const no_comment: TransformResult = {
  code: 'const __vite_ssr_import_0__ = await __vite_ssr_import__("vitest");\n'
    + '\n'
    + '__vite_ssr_import_0__.test("Math.sqrt()", () => {\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 300);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '});\n'
    + '\n'
    + '\n'
    + '//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUE2QjtBQUU3QiwyQkFBSyxlQUFlLE1BQU07QUFDeEIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLEdBQUc7QUFDOUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDOUIsQ0FBQyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyJDOi9wcm9qZWN0cy9HaXRodWIvbmV3LXByai90ZXN0L2luZGV4LnRlc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXNzZXJ0LCB0ZXN0IH0gZnJvbSAndml0ZXN0J1xuXG50ZXN0KCdNYXRoLnNxcnQoKScsICgpID0+IHtcbiAgYXNzZXJ0LmVxdWFsKE1hdGguc3FydCg0KSwgMilcbiAgYXNzZXJ0LmVxdWFsKE1hdGguc3FydCg0KSwgMilcbiAgYXNzZXJ0LmVxdWFsKE1hdGguc3FydCg0KSwgMilcbiAgYXNzZXJ0LmVxdWFsKE1hdGguc3FydCg0KSwgMilcbiAgYXNzZXJ0LmVxdWFsKE1hdGguc3FydCg0KSwgMzAwKVxuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAyKVxufSlcbiJdLCJmaWxlIjoiQzovcHJvamVjdHMvR2l0aHViL25ldy1wcmovdGVzdC9pbmRleC50ZXN0LnRzIn0=\n',
  map: {
    version: 3,
    mappings: ';AAA6B;AAE7B,2BAAK,eAAe,MAAM;AACxB,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,GAAG;AAC9B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC9B,CAAC',
    names: [],
    sources: ['C:/projects/Github/new-prj/test/index.test.ts'],
    sourcesContent: [
      'import { assert, test } from \'vitest\'\n'
        + '\n'
        + 'test(\'Math.sqrt()\', () => {\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 300)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '})\n',
    ],
    file: 'C:/projects/Github/new-prj/test/index.test.ts',
    toUrl: () => '',
    toString: () => '',
  },
  deps: ['vitest'],
  dynamicDeps: [],
}

const comment: TransformResult = {
  code: 'const __vite_ssr_import_0__ = await __vite_ssr_import__("vitest");\n'
    + '\n'
    + '__vite_ssr_import_0__.test("Math.sqrt()", () => {\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 300);\n'
    + '  __vite_ssr_import_0__.assert.equal(Math.sqrt(4), 2);\n'
    + '});\n'
    + '\n'
    + '\n'
    + '//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUE2QjtBQUk3QiwyQkFBSyxlQUFlLE1BQU07QUFDeEIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDNUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLEdBQUc7QUFDOUIsK0JBQU8sTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUM7QUFDOUIsQ0FBQyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyJDOi9wcm9qZWN0cy9HaXRodWIvbmV3LXByai90ZXN0L2luZGV4LnRlc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXNzZXJ0LCB0ZXN0IH0gZnJvbSAndml0ZXN0J1xuXG4vLyBjb21tZW50MVxuLy8gY29tbWVudDJcbnRlc3QoJ01hdGguc3FydCgpJywgKCkgPT4ge1xuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAyKVxuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAyKVxuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAyKVxuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAyKVxuICBhc3NlcnQuZXF1YWwoTWF0aC5zcXJ0KDQpLCAzMDApXG4gIGFzc2VydC5lcXVhbChNYXRoLnNxcnQoNCksIDIpXG59KVxuIl0sImZpbGUiOiJDOi9wcm9qZWN0cy9HaXRodWIvbmV3LXByai90ZXN0L2luZGV4LnRlc3QudHMifQ==\n',
  map: {
    version: 3,
    mappings: ';AAA6B;AAI7B,2BAAK,eAAe,MAAM;AACxB,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC5B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,GAAG;AAC9B,+BAAO,MAAM,KAAK,KAAK,CAAC,GAAG,CAAC;AAC9B,CAAC',
    names: [],
    sources: ['C:/projects/Github/new-prj/test/index.test.ts'],
    sourcesContent: [
      'import { assert, test } from \'vitest\'\n'
        + '\n'
        + '// comment1\n'
        + '// comment2\n'
        + 'test(\'Math.sqrt()\', () => {\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '  assert.equal(Math.sqrt(4), 300)\n'
        + '  assert.equal(Math.sqrt(4), 2)\n'
        + '})\n',
    ],
    file: 'C:/projects/Github/new-prj/test/index.test.ts',
    toUrl: () => '',
    toString: () => '',
  },
  deps: ['vitest'],
  dynamicDeps: [],
}

const no_comment_mod: Partial<ModuleNode> = {
  ssrTransformResult: no_comment,
}

const comment_mod: Partial<ModuleNode> = {
  ssrTransformResult: comment,
}

const moduleGraphNoComment: Partial<ModuleGraph> = {
  getModuleById: () => no_comment_mod as ModuleNode,
}

const moduleGraphentComment: Partial<ModuleGraph> = {
  getModuleById: () => comment_mod as ModuleNode,
}

afterEach(() => {
  vi.useRealTimers()
})

test('without comment', async () => {
  // Arrange
  const reporter = new JsonReporter()
  const context = getContext()
  context.vitest.server.moduleGraph = moduleGraphNoComment as ModuleGraph

  vi.setSystemTime(1642587001759)
  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)
  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

test('with comment', async () => {
  // Arrange
  const reporter = new JsonReporter()
  const context = getContext()
  context.vitest.server.moduleGraph = moduleGraphentComment as ModuleGraph

  vi.setSystemTime(1742587001759)
  // Act
  clearSourcePos()
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)
  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

