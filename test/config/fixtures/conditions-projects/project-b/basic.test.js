import { test, expect } from "vitest";
import conditionCustom from "test-dep-conditions/custom";
import conditionModule from "test-dep-conditions/module";
import conditionNode from "test-dep-conditions/node";
import conditionDevelopment from "test-dep-conditions/development";
import conditionProduction from "test-dep-conditions/production";
import inline from "test-dep-conditions/inline";
import indirect from "test-dep-conditions/indirect";

import { viteVersion } from "vitest/node";
const viteMajor = Number(viteVersion.split(".")[0]);

test("conditions", () => {
  expect({
    inline,
    conditionCustom,
    conditionModule,
    conditionNode,
    conditionDevelopment,
    conditionProduction,
    indirect,
  }).toEqual({
    inline: false,
    conditionCustom: false,
    conditionDevelopment: true,
    conditionModule: viteMajor <= 5,
    conditionNode: true,
    conditionProduction: false,
    indirect: {
      conditionCustom: false,
      conditionDevelopment: true,
      conditionModule: viteMajor <= 5 && inline,
      conditionNode: true,
      conditionProductioin: false,
    },
  });
});
