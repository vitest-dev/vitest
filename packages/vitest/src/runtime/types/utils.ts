export type SerializedSpec = [
  project: { name: string | undefined; root: string },
  file: string,
  options: { pool: string },
]
