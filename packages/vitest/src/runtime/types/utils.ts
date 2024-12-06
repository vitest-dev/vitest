export type SerializedTestSpecification = [
  project: { name: string | undefined; root: string },
  file: string,
  options: { pool: string; testLines?: number[] | undefined },
]
