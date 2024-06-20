export class IndentedLogger<T = any> {
  private currentIndent = ''

  constructor(private baseLog: (text: string) => T) {}

  indent() {
    this.currentIndent += '    '
  }

  unindent() {
    this.currentIndent = this.currentIndent.substring(
      0,
      this.currentIndent.length - 4,
    )
  }

  log(text: string): T {
    return this.baseLog(this.currentIndent + text)
  }
}
