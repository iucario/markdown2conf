import fs from 'fs/promises'
import path from 'path'

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

/**
 * Loads configuration from ~/.config/mdconf.json
 */
async function loadConfig(): Promise<{ confluenceToken: string; host: string }> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  const configDir = path.join(homeDir, '.config')
  const configPath = path.join(configDir, 'mdconf.json')

  try {
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content)
    if (!config.confluenceToken) {
      throw new Error('confluenceToken not found in config file')
    }
    if (!config.host) {
      throw new Error('host not found in config file')
    }
    return { confluenceToken: config.confluenceToken, host: config.host }
  } catch (err) {
    // If file does not exist, create it with a placeholder
    if (err.code === 'ENOENT') {
      await fs.mkdir(configDir, { recursive: true })
      const defaultConfig = { confluenceToken: '', host: 'https://your-confluence-host.example.com/confluence' }
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
      throw new Error('Config file created at ~/.config/mdconf.json. Please add your confluence token and host.')
    }
    throw new Error('Confluence token not found in ~/.config/mdconf.json')
  }
}

async function request(method: string, endpoint: string, body?: any): Promise<any> {
  let token = process.env.CONFLUENCE_TOKEN
  let base = 'localhost'
  try {
    const { confluenceToken, host } = await loadConfig()
    token = token || confluenceToken
    base = host
  } catch (err) {
    console.error(err.message)
  }
  if (!token) {
    throw new Error('Confluence token is missing in both environment and config file')
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const url = base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '')
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`requesting ${url} failed: ${response.status} ${text}`)
  }

  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${url}: ${err.message}\nRaw response: ${text}`)
  }
}

async function getPage(pageId: number): Promise<Page> {
  const api = `rest/api/content/${pageId}?expand=body.storage,version,history,space`
  const data = await request('GET', api)
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
  const api = `rest/api/content/${pageId}`
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

  return request('PUT', api, payload)
}

async function homePage(spaceKey: string): Promise<any> {
  const api = `rest/api/space/${spaceKey}?expand=homepage`
  return request('GET', api)
}

type CreatePageParams = {
  title: string
  storage: string
  space: string
  ancestorId: number
}

async function createPage({ title, storage, space, ancestorId }: CreatePageParams): Promise<any> {
  const api = `rest/api/content`

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
  const api = `rest/api/contentbody/convert/storage`
  const body = {
    value: markup,
    representation: 'wiki',
  }
  const data = await request('POST', api, body)
  return data.value
}

async function getAttachment(pageId: number): Promise<string[]> {
  const api = `rest/api/content/${pageId}/child/attachment`
  const data = await request('GET', api)
  return data.results.map((attachment: any) => attachment._links.download)
}

async function addAttachment(pageId: number, filePath: string, comment: string): Promise<any> {
  const api = `rest/api/content/${pageId}/child/attachment`
  const { confluenceToken: token } = await loadConfig()

  const filename = encodeURIComponent(path.basename(filePath))

  const fileBuffer = await fs.readFile(filePath)
  const uint8Array = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8Array], { type: 'image/png' })

  const formData = new FormData()
  formData.append('comment', comment)
  formData.append('file', blob, filename)

  const response = await fetch(api, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Atlassian-Token': 'nocheck', // Attachment upload requires this header
    },
    body: formData,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed ${pageId}: ${response.status} ${text}`)
  }
  return response.json()
}

async function postLabels(pageId: number, labels: string[]): Promise<any> {
  const api = `rest/api/content/${pageId}/label`
  const body = labels.map((label) => ({ prefix: 'global', name: label.toLowerCase() }))
  return request('POST', api, body)
}

async function listLabels(pageId: number): Promise<string[]> {
  const api = `rest/api/content/${pageId}/label`
  const data = await request('GET', api)
  return data.results.map((label: any) => label.name.toLowerCase())
}

async function deleteLabel(pageId: number, label: string): Promise<any> {
  const api = `rest/api/content/${pageId}/label/${label.toLowerCase()}`
  return request('DELETE', api)
}

/**
 * Synchronize labels on a Confluence page.
 * Add new labels and remove labels that are not provided.
 */
async function syncLabels(pageId: number, labels: string[]): Promise<void> {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const uniqueLabels = Array.from(new Set(normalizedLabels))
  const existingLabels = await listLabels(pageId)
  const toAdd = uniqueLabels.filter((label) => !existingLabels.includes(label))
  const toRemove = existingLabels.filter((label) => !uniqueLabels.includes(label))

  if (toAdd.length > 0) {
    await postLabels(pageId, toAdd)
  }
  for (const label of toRemove) {
    await deleteLabel(pageId, label)
  }
}

export {
  addAttachment,
  createPage,
  editPage,
  getAttachment,
  getPage,
  homePage,
  markupToStorage,
  Page,
  syncLabels,
  User,
}
