export class Logger {
  #config = {}
  info(msg: string): void { void msg }
  warn(msg: string): void { void msg }
}

export default new Logger()
