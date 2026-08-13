import type { SerializedRootConfig } from 'vitest'
import { getBadgeNameColor, getBadgeTextColor } from './task'

type ProjectConfigSource = Pick<Partial<SerializedRootConfig>, 'projects'>

export function getProjectConfigByName(
  config: ProjectConfigSource,
  projectName: string | undefined,
) {
  return config.projects?.find(project => project.name === projectName)
}

export function getProjectBadgeStyle(
  config: ProjectConfigSource,
  projectName: string | undefined,
) {
  const backgroundColor = getProjectConfigByName(config, projectName)?.color
    ?? getBadgeNameColor(projectName)

  return {
    backgroundColor,
    color: getBadgeTextColor(backgroundColor),
  }
}
