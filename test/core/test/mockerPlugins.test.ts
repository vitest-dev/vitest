import { beforeEach, describe, expect, it } from 'vitest'
import { MocksPlugin } from '../../../packages/vitest/src/plugins/mock'

describe('MocksPlugin', () => {
  let mocksPlugin: any

  beforeEach(() => {
    const defaultMocksPlugins = MocksPlugin()

    mocksPlugin = {
      ...defaultMocksPlugins,
      resolve(path: string, id: string) {
        return { path, id: `/home/${id}.ts` }
      },
    }
  })

  it('Do not override non mocked code', async() => {
    const code = `
      test('no mock found', () => {
        expect(1).toBe(1);
      });
    `
    const mockedCode = await mocksPlugin.transform(code)

    expect(mockedCode).toBeUndefined()
  })

  it('Do not override non mocked async code', async() => {
    const code = `
      test('no mock found', async () => {
        expect(1).toBe(1);
      });
    `
    const mockedCode = await mocksPlugin.transform(code, 'aa')

    expect(mockedCode).toBeUndefined()
  })

  it('Mock by file path', async() => {
    const code = `
      import aa from './aa';
      vi.mock('./aa');
      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `

    const mockedCode = await mocksPlugin.transform(code, 'aa')
    const actual = cleanText(mockedCode.code)
    const expected = cleanText(`
     await __vitest__mock__("/home/aa.ts", null);

      import aa from './aa';
      vi.mock('./aa');
      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `)

    expect(actual).toBe(expected)
  })

  it('Mock by file path with empty line before import', async() => {
    const code = `
      import aa from './aa';

      vi.mock('./aa');
      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `

    const mockedCode = await mocksPlugin.transform(code, 'aa')
    const actual = cleanText(mockedCode.code)
    const expected = cleanText(`
     await __vitest__mock__("/home/aa.ts", null);

      import aa from './aa';
      vi.mock('./aa');
      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `)

    expect(actual).toBe(expected)
  })

  it('Mock by file path with factory', async() => {
    const code = `
      import aa from './aa';

      vi.mock('./aa', () => {
        return {
          aa: () => {}
        };
      });

      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `

    const mockedCode = await mocksPlugin.transform(code, 'aa')
    const actual = cleanText(mockedCode.code)
    const expected = cleanText(`
      await __vitest__mock__("/home/aa.ts", null, () => {
        return {
          aa: () => {}
        };
      });

      import aa from './aa';

      vi.mock('./aa', () => {
        return {
          aa: () => {}
        };
      });

      test('Mock by filePath', async () => {
        expect(1).toBe(1);
      });
    `)

    expect(actual).toBe(expected)
  })
})

function cleanText(someText: string) {
  return someText.replace(/(\r\n|\n|\r|\s|\t)/gm, '')
}
