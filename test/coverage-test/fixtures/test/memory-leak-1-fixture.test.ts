import { test } from "vitest";
import { commands } from "vitest/browser";

test("report live documents", async () => {
  await (commands as any).countLiveDocuments();
});
