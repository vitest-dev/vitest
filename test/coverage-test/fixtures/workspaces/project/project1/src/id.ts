import { raise } from "../../shared/src/utils"

export const id = <T>(value: T) =>
  value ?? raise("Value cannot be undefined")
