const windowsDrivePathRE = /^[a-z]:[\\/]/i

export function normalizeWindowsDriveLetter(
  filepath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== 'win32' || !windowsDrivePathRE.test(filepath)) {
    return filepath
  }

  return filepath[0].toLowerCase() + filepath.slice(1)
}

export function isSameFilePath(
  left: string | undefined,
  right: string | undefined,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!left || !right) {
    return false
  }

  return left === right || normalizeWindowsDriveLetter(left, platform) === normalizeWindowsDriveLetter(right, platform)
}
