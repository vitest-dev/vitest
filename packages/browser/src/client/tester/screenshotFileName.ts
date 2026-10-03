/** Most common file name length limit (APFS, ext4, etc.). */
const MAX_FILE_NAME_LENGTH = 255

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36)
}

export type ScreenshotFileNameSanitize = 'nonWord' | 'alphanumeric'

export function createScreenshotFileName(
  fullName: string,
  options: {
    sanitize?: ScreenshotFileNameSanitize
    repeatNumber?: number
  } = {},
): string {
  const { sanitize = 'nonWord', repeatNumber } = options
  const sanitized =
    sanitize === 'nonWord'
      ? fullName.replace(/\W/g, '-')
      : fullName.replace(/[^a-z0-9]/gi, '-')

  const numberPart = repeatNumber !== undefined ? `-${repeatNumber}` : ''
  const extension = '.png'
  const suffix = `${numberPart}${extension}`

  if (sanitized.length + suffix.length <= MAX_FILE_NAME_LENGTH) {
    return `${sanitized}${suffix}`
  }

  const hashPart = `-${hashString(fullName).slice(0, 8)}`
  const maxBaseLength = MAX_FILE_NAME_LENGTH - suffix.length - hashPart.length
  const truncated = sanitized.slice(0, Math.max(1, maxBaseLength))
  return `${truncated}${hashPart}${suffix}`
}
