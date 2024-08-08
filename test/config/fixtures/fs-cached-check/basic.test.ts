import { expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"

test("import a generated file", async () => {
  const dist = path.join(import.meta.dirname, "dist");
  await fs.promises.mkdir(dist, { recursive: true });
  await fs.promises.writeFile(path.join(dist, "generated.js"), `export default 'ok'`);

  // @ts-ignore generated
  const mod = await import("./dist/generated.js")

  expect(mod.default).toBe("ok");
})
