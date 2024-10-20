import { beforeAll } from "vitest";
import { branch } from "./src/branch";

beforeAll(() => {
  branch(1);
});
