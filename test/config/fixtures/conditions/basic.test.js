import { test, expect } from 'vitest';
import conditionCustom from '@vitest/test-dep-conditions/custom';
import conditionModule from '@vitest/test-dep-conditions/module';
import conditionNode from '@vitest/test-dep-conditions/node';
import conditionDevelopment from '@vitest/test-dep-conditions/development';
import conditionProduction from '@vitest/test-dep-conditions/production';
import inline from '@vitest/test-dep-conditions/inline';
import indirect from '@vitest/test-dep-conditions/indirect';

import { viteVersion } from 'vitest/node'
const viteMajor = Number(viteVersion.split('.')[0])

test('conditions', () => {
  expect({
    conditionCustom,
    conditionModule,
    conditionNode,
    conditionDevelopment,
    conditionProduction,
    indirect
  }).toEqual(
    {
      conditionCustom: true,
      "conditionDevelopment": true,
      "conditionModule": viteMajor <= 5,
      "conditionNode": true,
      "conditionProduction": false,
      "indirect": {
        conditionCustom: true,
        "conditionDevelopment": true,
        "conditionModule": viteMajor <= 5 && inline,
        "conditionNode": true,
        "conditionProductioin": false,
      },
    }
  )
})
