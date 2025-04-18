import { test, expect, vi } from 'vitest';
import project2 from "../project2/index.js"
import "./imported-test.js"
import "../project3/imported-test.js"

vi.mock("../project2/index.js", () => ({
  default: 'project2-mocked'
}))

test("basic", () => {
  expect(project2).toMatchInlineSnapshot(`"project2-mocked"`)
})
