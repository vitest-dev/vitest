import { response } from "./slow-module";

export function uncovered() {
  throw new Error("uncovered");
}

export function uncovered2() {
  throw new Error("uncovered");
}

export function covered(value: number) {
  if(!response.ok) {
    throw new Error("response not ok");
  }

  return value + 100;
}
