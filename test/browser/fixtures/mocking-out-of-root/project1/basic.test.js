import { test, expect, vi } from 'vitest';
import project2 from "../project2/index.js"
import project1Utils from "../project1-utils/index.js"
import "./imported-test.js"
import "../project3/imported-test.js"

vi.mock("../project2/index.js", () => ({
  default: 'project2-mocked'
}))

vi.mock("../project1-utils/index.js", () => ({
  default: 'project1-utils-mocked'
}))

test("basic", () => {
  expect(project2).toMatchInlineSnapshot(`"project2-mocked"`)
})

test("sibling directory that shares the root prefix", () => {
  expect(project1Utils).toMatchInlineSnapshot(`"project1-utils-mocked"`)
})
