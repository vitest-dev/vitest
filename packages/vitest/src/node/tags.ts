import type { TestTagDefinition } from '@vitest/runner'
import type { TestProject } from './project'

export function populateProjectsTags(rootProject: TestProject, projects: TestProject[]): void {
  // Include root project if not already in the list
  const allProjects = projects.includes(rootProject) ? projects : [rootProject, ...projects]

  // Collect all tags from all projects (first definition wins)
  const globalTags = new Map<string, TestTagDefinition>()
  for (const project of allProjects) {
    for (const tag of project.config.tags || []) {
      if (!globalTags.has(tag.name)) {
        globalTags.set(tag.name, tag)
      }
    }
  }

  // Add missing tags to each project (without overriding local definitions)
  for (const project of allProjects) {
    const projectTagNames = new Set(project.config.tags.map(t => t.name))
    for (const [tagName, tagDef] of globalTags) {
      if (!projectTagNames.has(tagName)) {
        project.config.tags.push(tagDef)
      }
    }
  }
}
