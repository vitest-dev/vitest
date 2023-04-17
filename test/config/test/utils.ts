import { execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function runVitest(mode: 'run' | 'watch', cliArguments: string[]) {
  const subprocess = execa('vitest', [mode, 'fixtures/test/', ...cliArguments])
  let error = ''

  subprocess.stderr?.on('data', (data) => {
    error = stripAnsi(data.toString())

    // Sometimes on Windows CI execa doesn't exit properly. Force exit when stderr is caught.
    subprocess.kill()
  })

  await new Promise(resolve => subprocess.on('exit', resolve))

  return { error }
}
