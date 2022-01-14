export class IndentedLogger {
  private currentIndent = ''

  constructor(private baseLog: (text: string) => void) {
  }

  indent() {
    this.currentIndent += '    '
  }

  unindent() {
    this.currentIndent = this.currentIndent.substring(0, this.currentIndent.length - 4)
  }

  log(text: string) {
    this.baseLog(this.currentIndent + text)
  }
}
