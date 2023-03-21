export const importId = (id: string) => {
  const name = `/@id/${id}`
  return import(name)
}
