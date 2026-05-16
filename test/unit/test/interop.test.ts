// @ts-expect-error no type
import * as esModule from '@vitest/test-dep-cjs/esmodule'
// @ts-expect-error no type
import * as esModuleFalse from '@vitest/test-dep-cjs/esmodule-false'
import { expect, test } from 'vitest'

const nodeMajor = Number(process.versions.node.split('.')[0])

test('interop', async ({ task }) => {
  expect(esModule).toMatchInlineSnapshot(`
    {
      "__esModule": true,
      "test": "hello",
    }
  `)
  if (task.file.projectName === 'vmThreads' || nodeMajor < 23) {
    expect(esModuleFalse).toMatchInlineSnapshot(`
      {
        "__esModule": false,
        "default": {
          "__esModule": false,
          "test": "hello",
        },
        "test": "hello",
      }
    `)
  }
  else {
    expect(esModuleFalse).toMatchInlineSnapshot(`
      {
        "__esModule": false,
        "default": {
          "__esModule": false,
          "test": "hello",
        },
        "module.exports": {
          "__esModule": false,
          "test": "hello",
        },
        "test": "hello",
      }
    `)
  }
})
