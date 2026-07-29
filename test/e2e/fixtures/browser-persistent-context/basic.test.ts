import { expect, test } from "vitest";

const expectedValue = import.meta.env.TEST_EXPECTED_VALUE || "0";

test(`expectedValue = ${expectedValue}`, () => {
  // increment localStorage to test persistent context between test runs
  const value = localStorage.getItem("test-persistent-context") || "0";
  const nextValue = String(Number(value) + 1);
  console.log(`localStorage: value = ${value}, nextValue = ${nextValue}`);
  localStorage.setItem("test-persistent-context", nextValue);

  const div = document.createElement("div");
  div.textContent = `localStorage: value = ${value}, nextValue = ${nextValue}`;
  document.body.appendChild(div);

  expect(value).toBe(expectedValue)
});
