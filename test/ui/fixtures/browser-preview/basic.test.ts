import { expect, test } from "vitest";
import { page } from "vitest/browser";

test("hello button", async () => {
  document.body.innerHTML = "<button>hello</button>";
  await expect.element(page.getByRole("button")).toHaveTextContent("hello");
});
