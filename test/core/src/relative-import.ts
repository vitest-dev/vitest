export function dynamicRelativeImport(file) {
  return import(`./${file}.ts`)
}
