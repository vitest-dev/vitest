import { VitestSnapshotEnvironment } from 'vitest/runtime'

class DataReaderSnapshotEnvironment extends VitestSnapshotEnvironment {
  readSnapshotFile(filepath: string) {
    console.log('## readSnapshotFile', filepath)
    return super.readSnapshotFile(filepath)
  }

  async readSnapshotFileData(filepath: string) {
    console.log('## readSnapshotFileData', filepath)
    return super.readSnapshotFile(filepath).then((content) => {
      if (content == null) {
        return null
      }
      const data = Object.create(null)
      // eslint-disable-next-line no-new-func
      const populate = new Function('exports', content)
      populate(data)
      return data
    })
  }
}

export default new DataReaderSnapshotEnvironment()
