import fs from "node:fs";
import { testLogFile } from "./helper";

export default async function setup() {
  await fs.promises.rm(testLogFile, { force: true });
}
