export interface PublicModuleRunner {
  import: (id: string) => Promise<any>
}
