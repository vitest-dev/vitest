export class GetterTracker {
  static EXPORTS_MAX_INVOCATIONS = 1_000_000

  private invocations = new Map<string, number>()
  private excessiveInvocations = new Map<string, GetterTrackerExport>()

  public createTracker(
    moduleId: string,
    defineExport: (name: string, getter: () => unknown) => void,
  ): (name: string, getter: () => unknown) => void {
    return (name, getter) => {
      const key = `${moduleId}:${name}`
      defineExport(name, () => {
        const count = (this.invocations.get(key) || 0) + 1
        this.invocations.set(key, count)
        if (count > GetterTracker.EXPORTS_MAX_INVOCATIONS && !this.excessiveInvocations.has(key)) {
          this.excessiveInvocations.set(key, { moduleId, exportName: name })
        }
        return getter()
      })
    }
  }

  public resetInvocations(): void {
    this.invocations.clear()
    this.excessiveInvocations.clear()
  }

  public getExcessiveInvocations(): GetterTrackerExport[] {
    return [...this.excessiveInvocations.values()]
  }
}

export interface GetterTrackerExport {
  moduleId: string
  exportName: string
}
