import { relative as _relative } from 'pathe'
import { VitestSnapshotEnvironment } from 'vitest/snapshot'

function relative(file: string) {
  return _relative(process.cwd(), file)
}

class CustomSnapshotEnvironment extends VitestSnapshotEnvironment {
  getVersion(): string {
    console.log('## getVersion')
    return super.getVersion()
  }

  getHeader() {
    console.log('## getHeader')
    return super.getHeader()
  }

  resolvePath(filepath: string) {
    console.log('## resolvePath', relative(filepath))
    return super.resolvePath(filepath)
  }

  resolveRawPath(testPath: string, rawPath: string) {
    console.log('## resolveRawPath', relative(testPath), relative(rawPath))
    return super.resolveRawPath(testPath, rawPath)
  }

  saveSnapshotFile(filepath: string, snapshot: string) {
    console.log('## saveSnapshotFile', relative(filepath))
    return super.saveSnapshotFile(filepath, snapshot)
  }

  readSnapshotFile(filepath: string) {
    console.log('## readSnapshotFile', relative(filepath))
    return super.readSnapshotFile(filepath)
  }

  removeSnapshotFile(filepath: string) {
    console.log('## removeSnapshotFile', relative(filepath))
    return super.removeSnapshotFile(filepath)
  }
}

export default new CustomSnapshotEnvironment()
