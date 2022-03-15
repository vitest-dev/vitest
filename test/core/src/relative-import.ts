export function dynamicRelativeImport(file: string) {
  return import(`./${file}.ts`)
}
