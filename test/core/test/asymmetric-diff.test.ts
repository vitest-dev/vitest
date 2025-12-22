import { describe, expect, it } from 'vitest'

describe('asymmetric matcher diff display', () => {
  it('shows clear diff when simple property mismatch', () => {
    const actual = {
      user: {
        name: 'John',
        age: 25,
        email: 'john@example.com',
      },
    }

    // Test should fail - name doesn't contain "Jane"
    try {
      expect(actual).toMatchObject({
        user: expect.objectContaining({
          name: expect.stringContaining('Jane'),
          age: expect.any(Number),
          email: expect.stringContaining('example.com'),
        }),
      })
    }
    catch (error: any) {
      console.log('Mismatch with objectContaining:')
      console.log(error.message)
      throw error
    }
  })

  it('shows clear diff with nested objectContaining - complex case', () => {
    // Actual data structure similar to the issue example
    const actual = {
      model: 'veo-3.1-generate-preview',
      instances: [
        {
          prompt: 'walk',  // This doesn't match the expected regex
          referenceImages: [
            {
              image: {
                gcsUri: 'gs://example/person1.jpg',
                mimeType: 'image/png',  // Mismatch: expected jpeg
              },
              referenceType: 'asset',
            },
            {
              image: {
                gcsUri: 'gs://example/person.jpg',  // Mismatch: doesn't contain "person2.png"
                mimeType: 'image/png',
              },
              referenceType: 'asset',
            },
          ],
        },
      ],
      parameters: {
        durationSeconds: '8',  // Mismatch: string instead of number
        aspectRatio: '16:9',
        generateAudio: true,
      },
    }

    // This should fail with multiple mismatches
    try {
      expect(actual).toMatchObject({
        model: expect.stringMatching(/^veo-3\.1-(fast-)?generate-preview$/),
        instances: expect.arrayContaining([
          expect.objectContaining({
            prompt: expect.stringMatching(/^(?=.*walking)(?=.*together)(?=.*park).*/i),
            referenceImages: expect.arrayContaining([
              expect.objectContaining({
                image: expect.objectContaining({
                  gcsUri: expect.stringContaining('person1.jpg'),
                  mimeType: 'image/jpeg',
                }),
                referenceType: expect.stringMatching(/^(asset|style)$/),
              }),
              expect.objectContaining({
                image: expect.objectContaining({
                  gcsUri: expect.stringContaining('person2.png'),
                  mimeType: 'image/png',
                }),
                referenceType: expect.stringMatching(/^(asset|style)$/),
              }),
            ]),
          }),
        ]),
        parameters: expect.objectContaining({
          durationSeconds: expect.any(Number),
          aspectRatio: '16:9',
          generateAudio: expect.any(Boolean),
        }),
      })
    }
    catch (error: any) {
      console.log('Complex nested structure diff:')
      console.log(error.message)
      throw error
    }
  })
})

