import { createCLIWithCompletions } from './cli/cac'

createCLIWithCompletions().then(cli => cli.parse())
