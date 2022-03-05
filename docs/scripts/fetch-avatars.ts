import type { Stats } from 'fs'
import { promises as fs } from 'fs'
import type { RequestInit } from 'node-fetch'
import fetch from 'node-fetch'
import { coreTeamMembers } from '../src/contributors'

interface Contributor {
  login: string
  avatar_url: string
}
interface ImageRequest {
  key: string
  url: string
}
interface ImageData {
  key: string
  extension: string
  lastModified: string | number
}
interface ImageResponse extends ImageData {
  image: Blob
}
interface Avatar {
  name: string
  images?: [ImageResponse, ImageResponse]
}

const members = coreTeamMembers.map(member => member.github)
const avatarsName = '../docs/avatars.json'
const contributorsName = '../docs/contributors.json'

let storedImages: Record<string, Omit<ImageData, 'key'>> = {}
let contributors: string[] = []

async function fetchImage({ url, key }: ImageRequest): Promise<ImageResponse | undefined> {
  const imageData = storedImages[key]
  const options: RequestInit = {
    redirect: 'follow',
  }
  if (imageData) {
    options.headers = {
      'If-Modified-Since': `${imageData!.lastModified}`,
    }
  }

  const response = await fetch(url, options)
  if (response) {
    // avatar not modified: exclude image to be stored
    if (response.status === 304)
      return undefined

    if (response.status !== 200)
      throw new Error(`invalid response status [${response.status}] for image with key ${key}: ${url}`)

    let extension = '.png'
    const contentType = response.headers.get('content-type')
    if (contentType) {
      switch (contentType) {
        case 'image/webp':
          extension = '.webp'
          break
        case 'image/jpeg':
          extension = '.jpeg'
          break
        case 'image/jpg':
          extension = '.jpg'
          break
        case 'image/gif':
          extension = '.gif'
          break
        case 'text/xml':
        case 'image/svg+xml':
          extension = '.svg'
          break
      }
    }
    const image = await response.blob()
    return {
      key,
      extension,
      lastModified: response.headers.get('last-modified') ?? Date.now(),
      image,
    }
  }
  else {
    throw new Error(`no response for image with key: ${key}`)
  }
}

async function fetchImageAvatars({ login, avatar_url }: Contributor) {
  const url = `${avatar_url}${avatar_url}?size=${members.includes(login) ? '100' : '40'}`
  return [await fetchImage({ key: login, url })]
}

async function fetchAvatars(): Promise<Avatar[]> {
  return await Promise.all(contributors.map(async(name) => {
    const images = await fetchImageAvatars({ login: name, avatar_url: `https://github.com/${name}.png` })
    return {
      name,
      images,
    }
  })) as Avatar[]
}

async function generate() {
  let stat: Stats | undefined
  try {
    stat = await fs.lstat(avatarsName)
  }
  catch {}

  if (stat && stat.isFile())
    storedImages = JSON.parse(await fs.readFile(avatarsName, { encoding: 'utf-8' }))

  contributors = JSON.parse(await fs.readFile(contributorsName, { encoding: 'utf-8' }))

  const avatars = await fetchAvatars()
  const storeImages: Omit<ImageResponse, 'lastModified'>[] = []
  avatars.filter(i => !!i.images).forEach(({ images }) => {
    images?.filter(i => !!i)?.forEach(({ key, lastModified, extension, image }) => {
      const entry = storedImages[key]
      if (entry) {
        entry.lastModified = lastModified
        entry.extension = extension
      }
      else {
        storedImages[key] = { lastModified, extension }
      }
      storeImages.push({ key, extension, image })
    })
  })

  if (storeImages.length > 0) {
    await Promise.all(storeImages.map(async({ key, extension, image }) => {
      await fs.writeFile(`../docs/public/images/${key}${extension}`, image.stream())
    }))
    await fs.writeFile(avatarsName, JSON.stringify(storedImages, null, 2), 'utf8')
  }
}

generate()
