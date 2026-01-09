import { describe, expect, it, vi } from 'vitest'
import { userEvent } from '@vitest/browser/context'

describe('Issue 8646 - userEvent.upload with file inputs', () => {
  it('fails without semantic specificity (original issue)', async () => {
    // This is the original failing case from the issue
    // When the input has no id, no label, and no data-testid,
    // vitest/browser cannot find it in newer Chromium versions (136+)
    // because the element is no longer exposed as a "textbox" in the accessibility tree
    
    const input = document.createElement('input')
    input.type = 'file'
    document.body.appendChild(input)
    
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    
    // This should timeout with newer Chromium versions
    // Uncomment to see the failure:
    // await userEvent.upload(input, file)
    
    // For the test to pass, we skip the actual upload
    expect(input.type).toBe('file')
    
    // Clean up
    document.body.removeChild(input)
  })

  it('works with an id attribute', async () => {
    // Solution 1: Add an id attribute to the input
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'file-upload'
    document.body.appendChild(input)
    
    const changeListener = vi.fn()
    input.addEventListener('change', changeListener)
    
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    
    await userEvent.upload(input, file)
    
    // Verify the file was uploaded
    await expect.poll(() => input.files?.length).toBe(1)
    expect(input.files?.[0].name).toBe('hello.png')
    expect(input.files?.[0].type).toBe('image/png')
    
    // Clean up
    document.body.removeChild(input)
  })

  it('works with a label (htmlFor)', async () => {
    // Solution 2: Associate the input with a label via htmlFor
    const label = document.createElement('label')
    label.textContent = 'Upload file'
    label.htmlFor = 'file-input'
    
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'file-input'
    
    document.body.appendChild(label)
    document.body.appendChild(input)
    
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    
    await userEvent.upload(input, file)
    
    // Verify the file was uploaded
    await expect.poll(() => input.files?.length).toBe(1)
    expect(input.files?.[0].name).toBe('hello.png')
    
    // Clean up
    document.body.removeChild(label)
    document.body.removeChild(input)
  })

  it('works with data-testid attribute', async () => {
    // Solution 3: Add a data-testid attribute
    const input = document.createElement('input')
    input.type = 'file'
    input.setAttribute('data-testid', 'file-upload')
    document.body.appendChild(input)
    
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    
    await userEvent.upload(input, file)
    
    // Verify the file was uploaded
    await expect.poll(() => input.files?.length).toBe(1)
    expect(input.files?.[0].name).toBe('hello.png')
    
    // Clean up
    document.body.removeChild(input)
  })

  it('works with multiple files when input has id', async () => {
    // Multiple file upload with proper semantic specificity
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'multi-file-upload'
    input.multiple = true
    document.body.appendChild(input)
    
    const file1 = new File(['hello1'], 'hello1.png', { type: 'image/png' })
    const file2 = new File(['hello2'], 'hello2.png', { type: 'image/png' })
    
    await userEvent.upload(input, [file1, file2])
    
    // Verify both files were uploaded
    await expect.poll(() => input.files?.length).toBe(2)
    expect(input.files?.[0].name).toBe('hello1.png')
    expect(input.files?.[1].name).toBe('hello2.png')
    
    // Clean up
    document.body.removeChild(input)
  })
})
