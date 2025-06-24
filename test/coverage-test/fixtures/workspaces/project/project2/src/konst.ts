import { raise } from "../../shared/src/utils"

export const konst = <T>(value: T) => {
  value ??= raise("Value cannot be undefined")
  return () => value
}
