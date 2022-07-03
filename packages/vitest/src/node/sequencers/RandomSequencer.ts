import { BaseSequencer } from './BaseSequencer'

export class RandomSequencer extends BaseSequencer {
  private random(seed: number) {
    const x = Math.sin(seed++) * 10000
    return x - Math.floor(x)
  }

  public async sort(files: string[]) {
    const { sequence } = this.ctx.config

    let seed = sequence?.seed ?? Date.now()
    let length = files.length

    while (length) {
      const index = Math.floor(this.random(seed) * length--)

      const previous = files[length]
      files[length] = files[index]
      files[index] = previous
      ++seed
    }

    return files
  }
}
