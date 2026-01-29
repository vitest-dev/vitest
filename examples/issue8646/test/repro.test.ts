import { it } from "vitest";
import { userEvent } from "vitest/browser";

it("repro", async () => {
  const input = document.createElement("input");
  input.type = "file";
  document.body.appendChild(input);

  const file = new File(["hello"], "hello.png", { type: "image/png" });
  await userEvent.upload(input, file)
});
