import { execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function runVitest(mode: 'run' | 'watch', cliArguments: string[]) {
  const subprocess = execa('vitest', [mode, 'fixtures/test/', ...cliArguments])
  let error = ''
  let output = ''

  subprocess.stdout?.on('data', (data) => {
    output += stripAnsi(data.toString())
  })

  subprocess.stderr?.on('data', (data) => {
    error += stripAnsi(data.toString())
  })

  await new Promise(resolve => subprocess.on('exit', resolve))

  return { output, error }
}
