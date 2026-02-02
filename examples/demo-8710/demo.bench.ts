import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as ungapParse, stringify as ungapStringify } from "@ungap/structured-clone/json";
import { parse as devalueParse, stringify as devalueStringify } from "devalue";
import { parse as flattedParse, stringify as flattedStringify } from "flatted";
import { beforeAll, bench, describe } from "vitest";

let data: any;

beforeAll(async () => {
  const cwd = import.meta.dirname;
  const flattedFile = process.env.FLATTED_FILE ?? resolve(cwd, "fixtures/blob-500-flatted.json");
  const devalueFile = process.env.DEVALUE_FILE ?? resolve(cwd, "fixtures/blob-500-devalue.json");
  const ungapFile = process.env.UNGAP_FILE ?? resolve(cwd, "fixtures/blob-500-ungap.json");

  const [flattedText, devalueText, ungapText] = await Promise.all([
    readFile(flattedFile, "utf-8"),
    readFile(devalueFile, "utf-8"),
    readFile(ungapFile, "utf-8"),
  ]);

  const flattedValue = flattedParse(flattedText);
  const devalueValue = devalueParse(devalueText);
  const ungapValue = ungapParse(ungapText);

  data = {
    flattedText,
    devalueText,
    ungapText,
    flattedValue,
    devalueValue,
    ungapValue,
  };
});

describe("parse", () => {
  bench("flatted", () => {
    flattedParse(data.flattedText);
  });

  bench("devalue", () => {
    devalueParse(data.devalueText);
  });

  bench("@ungap/structured-clone", () => {
    ungapParse(data.ungapText);
  });
});

describe("stringify", () => {
  bench("flatted", () => {
    flattedStringify(data.flattedValue);
  });

  bench("devalue", () => {
    devalueStringify(data.devalueValue);
  });

  bench("@ungap/structured-clone", () => {
    ungapStringify(data.ungapValue);
  });
});
