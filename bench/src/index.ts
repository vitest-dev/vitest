import { runBench } from './bench'

runBench((results) => {
  const displayData = results
    .map(r => ({
      name: r.name,
      time: `${r.mean.toFixed(3)}s ± ${r.rme.toFixed(2)}%`,
    }))
    .reduce((res, r) => {
      res[r.name] = {
        time: r.time,
      }
      return res
    }, {})

  // eslint-disable-next-line no-console
  console.table(displayData)
})
