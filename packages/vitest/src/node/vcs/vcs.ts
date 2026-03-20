export interface VCSProviderOptions {
  root: string
  changedSince?: string | boolean
}

export interface VCSProvider {
  // eslint-disable-next-line ts/method-signature-style
  findChangedFiles(options: VCSProviderOptions): Promise<string[]>
}
