export function dynamicRelativeImport(file: string) {
  return import(/* @vite-ignore */ `./${file}.ts`)
}
