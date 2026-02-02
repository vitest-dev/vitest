import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as devalueParse, stringify as devalueStringify } from "devalue";
import { parse as flattedParse, stringify as flattedStringify } from "flatted";
import { beforeAll, bench, describe } from "vitest";

let data: any;

beforeAll(async () => {
  const cwd = import.meta.dirname;
  const flattedFile = process.env.FLATTED_FILE ?? resolve(cwd, "fixtures/blob-500-flatted.json");
  const devalueFile = process.env.DEVALUE_FILE ?? resolve(cwd, "fixtures/blob-500-devalue.json");

  const [flattedText, devalueText] = await Promise.all([
    readFile(flattedFile, "utf-8"),
    readFile(devalueFile, "utf-8"),
  ]);

  const flattedValue = flattedParse(flattedText);
  const devalueValue = devalueParse(devalueText);

  data = {
    flattedText,
    devalueText,
    flattedValue,
    devalueValue,
  };
});

describe("parse", () => {
  bench("flatted", () => {
    flattedParse(data.flattedText);
  });

  bench("devalue", () => {
    devalueParse(data.devalueText);
  });
});

describe("stringify", () => {
  bench("flatted", () => {
    flattedStringify(data.flattedValue);
  });

  bench("devalue", () => {
    devalueStringify(data.devalueValue);
  });
});
