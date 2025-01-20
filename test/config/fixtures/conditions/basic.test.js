import { test, expect } from 'vitest';
import conditionModule from '@vitest/test-dep-conditions/module';
import conditionNode from '@vitest/test-dep-conditions/node';
import conditionDevelopment from '@vitest/test-dep-conditions/development';
import conditionProduction from '@vitest/test-dep-conditions/production';
import indirect from '@vitest/test-dep-conditions/indirect';

// TODO: test on Vite 6
// import { viteVersion } from 'vitest/node'
// const viteMajor = Number(viteVersion.split('.')[0])

test('conditions', () => {
  expect({
    conditionModule,
    conditionNode,
    conditionDevelopment,
    conditionProduction,
    indirect
  }).toEqual(
    {
      "conditionDevelopment": true,
      "conditionModule": true,
      "conditionNode": true,
      "conditionProduction": false,
      "indirect": {
        "conditionDevelopment": true,
        "conditionModule": false,
        "conditionNode": true,
        "conditionProductioin": false,
      },
    }
  )
})
