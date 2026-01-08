import { expect, test } from "vitest";

test("basic", () => {
  // increment localStorage to test persistent context between test runs
  const value = localStorage.getItem("test-persistent-context") || "0";
  const nextValue = String(Number(value) + 1);
  console.log(`localStorage: value = ${value}, nextValue = ${nextValue}`);
  localStorage.setItem("test-persistent-context", nextValue);

  const div = document.createElement("div");
  div.textContent = `localStorage: value = ${value}, nextValue = ${nextValue}`;
  document.body.appendChild(div);

  expect(value).toBe(import.meta.env.TEST_PERSISTENT_CONTEXT || "0")
});
