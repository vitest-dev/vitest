import { expect, test } from "vitest";
import {getJSON} from "../src/json-data-import";
import json from "../src/json-data.json";

test("JSON data", () => {
  expect(getJSON()).toEqual(json);
});
