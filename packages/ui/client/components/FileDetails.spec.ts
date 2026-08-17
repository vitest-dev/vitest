import { describe, expect, it, TestRunner } from 'vitest'
import { client } from '~/composables/client'
import { activeFileId, selectedTest, viewMode } from '~/composables/params'
import { page, render } from '~/test'
import FileDetails from './FileDetails.vue'

describe('FileDetails', () => {
  it('renders file-level report when selectedTest points to a suite', async () => {
    const file = TestRunner.createFileTask('test/example.ts', '', '')
    file.mode = 'run'
    file.result = { state: 'pass' }

    client.state.idMap.set(file.id, file)
    activeFileId.value = file.id
    selectedTest.value = file.id
    viewMode.value = null

    await render(FileDetails)

    await expect.element(page.getByTestId('report')).toBeInTheDocument()
  })
})
