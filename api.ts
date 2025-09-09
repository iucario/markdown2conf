import fs from 'fs'

const HOST = '' // Wirte your domain

interface Page {
  id: string
  title: string
  storage: string
  version: number
  updatedAt: string // 2024-08-19T09:42:35.624+09:00
  updatedBy: string // username
  createdAt: string
  createdBy: string
  tinyui: string // /x/abcd123
  space: string // ~username
}

interface User {
  username: string
  displayName: string
  userKey: string
  avatar: string // version.by.profilePicture.path
}

async function request(method: string, url: string, body?: any): Promise<any> {
  const token = process.env.CONFLUENCE_TOKEN
  if (!token) {
    throw new Error('CONFLUENCE_TOKEN is not set')
  }
  const headers = { Authorization: `Bearer ${token}` }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function getPage(pageId: number): Promise<Page> {
  const api = `${HOST}/rest/api/content/${pageId}?expand=body.storage,version,history,space`
  const token = process.env.CONFLUENCE_TOKEN

  if (!token) {
    throw new Error('CONFLUENCE_TOKEN is not set')
  }

  const response = await fetch(api, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${pageId}: ${response.status} ${text}`)
  }

  const data = await response.json()
  const page: Page = {
    id: data.id,
    title: data.title,
    storage: data.body.storage.value,
    version: data.version.number,
    updatedAt: data.version.when,
    updatedBy: data.version.by.username,
    createdAt: data.history.createdDate,
    createdBy: data.history.createdBy.username,
    tinyui: data._links.base + data._links.tinyui,
    space: data.space.key,
  }

  return page
}

async function editPage(
  pageId: number,
  storage: string,
  title: string,
  nextVersion: number,
  space: string,
  message: string = ''
): Promise<any> {
  const api = `${HOST}/rest/api/content/${pageId}`
  const token = process.env.CONFLUENCE_TOKEN

  if (!token) {
    console.log('No token')
    throw new Error('CONFLUENCE_TOKEN is not set')
  }

  const payload = {
    id: pageId,
    type: 'page',
    title: title,
    space: {
      key: space,
    },
    body: {
      storage: {
        value: storage,
        representation: 'storage',
      },
    },
    version: {
      number: nextVersion,
      message: message,
    },
  }

  const response = await fetch(api, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${pageId}: ${response.status} ${text}`)
  }

  return response.json()
}

async function homePage(spaceKey: string): Promise<any> {
  const api = `${HOST}/rest/api/space/${spaceKey}?expand=homepage`
  return request('GET', api)
}

type CreatePageParams = {
  title: string
  storage: string
  space: string
  ancestorId: number
}

async function createPage({ title, storage, space, ancestorId }: CreatePageParams): Promise<any> {
  const api = `${HOST}/rest/api/content`

  const payload = {
    type: 'page',
    title: title,
    space: {
      key: space,
    },
    ancestors: [{ id: Number(ancestorId) }],
    body: {
      storage: {
        value: storage,
        representation: 'storage',
      },
    },
  }

  return request('POST', api, payload)
}

async function markupToStorage(markup: string): Promise<string> {
  const api = `${HOST}/rest/api/contentbody/convert/storage`

  const response = await fetch(api, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value: markup,
      representation: 'wiki',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.value
}

async function getAttachment(pageId: number): Promise<string[]> {
  const api = `${HOST}/rest/api/content/${pageId}/child/attachment`
  const token = process.env.CONFLUENCE_TOKEN

  if (!token) {
    throw new Error('CONFLUENCE_TOKEN is not set')
  }

  const response = await fetch(api, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${pageId}: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.results.map((attachment: any) => attachment._links.download)
}

async function addAttachment(pageId: number, filePath: string, comment: string): Promise<any> {
  const api = `${HOST}/rest/api/content/${pageId}/child/attachment`
  const token = process.env.CONFLUENCE_TOKEN

  if (!token) {
    throw new Error('CONFLUENCE_TOKEN is not set')
  }

  const fileExtension = filePath.split('.').pop()
  const filename = filePath
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9.-]/g, '_') // Sanitize filename
  // Use a random UUID if filename is not available

  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer], { type: 'image/png' })

  const formData = new FormData()
  formData.append('comment', comment)
  formData.append('file', blob, filename)

  const response = await fetch(api, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Atlassian-Token': 'nocheck',
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${pageId}: ${response.status} ${text}`)
  }

  return response.json()
}

export { Page, User, getPage, editPage, createPage, markupToStorage, getAttachment, addAttachment, homePage }
