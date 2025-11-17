import path from 'path'
import fs from 'fs/promises'
import { addAttachment, editPage, getPage, markupToStorage, syncLabels } from './api.js'
import { convertToConfluence, extractFrontMatter } from './convert.js'

function inferPageId(srcFile: string): number {
    const pattern = /(\d{9,})/
    const match = srcFile.match(pattern)
    if (match) {
        return parseInt(match[1], 10)
    }
    throw new Error('Page ID not found in the file name')
}

interface UpdatePageParams {
    pageId: number
    storage: string
    message: string
    labels?: string[]
    title?: string
}

async function updateConfluencePage(params: UpdatePageParams) {
    const { pageId, storage, message, title, labels = [] } = params
    const page = await getPage(pageId)
    if (labels.length > 0) {
        await syncLabels(pageId, labels)
    }
    const pageTitle = title || page.title
    const result = await editPage(pageId, storage, pageTitle, page.version + 1, page.space, message)
    console.log(`Published to Confluence: version ${result.version.number}\n${page.tinyui}`)
}

async function mdToStorage(markdownPath: string, options: { title?: string }) {
    const markdown = await fs.readFile(markdownPath, 'utf-8')
    const attrs = await extractFrontMatter(markdown)
    const title = options.title || (attrs.title as string) || ''
    if (!title) {
        throw new Error('Title is required to create a new page, either via --title or in frontmatter')
    }
    const { markup, localImages } = await convertToConfluence(markdown, { outputPath: undefined })
    const storage = await markupToStorage(markup)
    return { title, storage, localImages }
}

async function upploadImages(pageId: number, imagePaths: string[]): Promise<any[]> {
    const results: any[] = []

    for (const imagePath of imagePaths) {
      console.info(`Uploading image: ${imagePath}`)
      try {
        const result = await addAttachment(pageId, imagePath, 'Uploaded by mdconf')
        results.push(result)
      } catch (error) {
        console.error(`Failed to upload ${imagePath}: ${error.message}`)
        results.push(null)
      }
    }

    return results
}

function relativePaths(basePath: string, imagePaths: string[]): string[] {
    const baseDir = path.dirname(basePath)
    return imagePaths.map((imgPath) => {
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            return imgPath
        }
        if (path.isAbsolute(imgPath)) {
            return imgPath
        }
        return path.resolve(baseDir, decodeURIComponent(imgPath))
    })
}


export { inferPageId, updateConfluencePage, mdToStorage, upploadImages, relativePaths }