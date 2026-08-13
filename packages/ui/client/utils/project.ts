import type { SerializedRootConfig } from 'vitest'
import { getBadgeNameColor, getBadgeTextColor } from './task'

export function getProjectConfigByName(
  // TODO: config shouldn't be partial in valid app lifetime. rework later.
  config: Partial<SerializedRootConfig>,
  projectName: string | undefined,
) {
  return config.projects?.find(project => project.name === projectName)
}

export function getProjectBadgeStyle(
  config: Partial<SerializedRootConfig>,
  projectName: string | undefined,
) {
  const backgroundColor = getProjectConfigByName(config, projectName)?.color
    ?? getBadgeNameColor(projectName)
  return {
    backgroundColor,
    color: getBadgeTextColor(backgroundColor),
  }
}
