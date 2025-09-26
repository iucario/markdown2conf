import { Command } from 'commander'
import fs from 'fs/promises'
import path from 'path'
import { addAttachment, createPage, editPage, getPage, homePage, markupToStorage, syncLabels } from './api.js'
import { convertToConfluence, extractFrontMatter } from './convert.js'

const VERSION = '1.4.8'

function inferPageId(srcFile: string): number {
  const pattern = /(\d{9,})/
  const match = srcFile.match(pattern)
  if (match) {
    return parseInt(match[1], 10)
  }
  throw new Error('Page ID not found in the file name')
}

async function main() {
  const program = new Command()
  program.name('mdconf').description('Markdown to Confluence Wiki Markup Converter').version(VERSION)

  program
    .argument('<input.md>', 'Markdown input file')
    .argument('[output.confluence]', 'Output file (optional)')
    .action(async (input, output) => {
      try {
        const markdown = await fs.readFile(input, 'utf-8')
        const { markup } = await convertToConfluence(markdown, {
          outputPath: output,
        })
        if (!output) {
          console.log(markup)
        }
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program
    .command('frontmatter <input.md>')
    .description('Extract frontmatter (title, labels)')
    .action(async (input) => {
      try {
        const markdown = await fs.readFile(input, 'utf-8')
        const attrs = await extractFrontMatter(markdown)
        console.log(JSON.stringify(attrs, null, 2))
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program
    .command('publish <markdown.md>')
    .alias('pub')
    .option('-i, --id <pageId>', 'Confluence Page ID to update')
    .option('-m, --message <message>', 'Message for the update')
    .option('--markup', 'Input is already in Confluence markup format', false)
    .option('-a, --attachment', 'Also upload local images as attachments', false)
    .description('Convert markdown/markup to storage format and publish to Confluence page')
    .action(
      async (filePath: string, options: { id?: string; message?: string; markup: boolean; attachment: boolean }) => {
        try {
          const message = options.message || ''
          if (options.markup) {
            const pageIdNum = options.id ? Number(options.id) : inferPageId(filePath)
            if (isNaN(pageIdNum)) {
              throw new Error(`Invalid or missing page ID ${options.id}`)
            }
            const markup = await fs.readFile(filePath, 'utf-8')
            const storage = await markupToStorage(markup)
            await updateConfluencePage(pageIdNum, storage, message)
          } else {
            const markdown = await fs.readFile(filePath, 'utf-8')
            const attrs = await extractFrontMatter(markdown)
            const pageIdNum = options.id ? Number(options.id) : attrs.id ? Number(attrs.id) : 0
            if (isNaN(pageIdNum) || pageIdNum <= 0) {
              throw new Error(`Invalid or missing page ID ${options.id || attrs.id}`)
            }
            const labels = attrs.labels || []
            const { storage, localImages } = await mdToStorage(filePath, {})
            await updateConfluencePage(pageIdNum, storage, message, labels)
            if (options.attachment && localImages.length > 0) {
              const relativeImagePaths = relativePaths(filePath, localImages)
              upploadImages(pageIdNum, relativeImagePaths)
            }
          }
        } catch (error) {
          console.error(`${error.message}`)
          process.exit(1)
        }
      }
    )

  program
    .command('new <markdown.md>')
    .option('-s, --space <space>', 'Confluence Space Key', '')
    .option('-t , --title <title>', 'Title of the new page (optional, can be in frontmatter)', '')
    .description('Create a new Confluence page from markdown with frontmatter')
    .action(async (filePath: string, options: { space: string; title?: string }) => {
      const space = options.space
      if (!space) {
        console.error('Space key is required for creating a new page')
        process.exit(1)
      }
      try {
        const { title, storage, localImages } = await mdToStorage(filePath, options)
        const homepageData = await homePage(space)
        const ancestorId = homepageData.homepage.id
        const result = await createPage({ title, storage, space, ancestorId })
        console.log(`Created new Confluence page:\n${result._links.base + result._links.tinyui}`)
        if (localImages.length > 0) {
          const relativeImagePaths = relativePaths(filePath, localImages)
          upploadImages(result.id, relativeImagePaths)
        }
        const attrs = await extractFrontMatter(await fs.readFile(filePath, 'utf-8'))
        if (attrs.labels && attrs.labels.length > 0) {
          syncLabels(result.id, attrs.labels)
        }
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program.parse(process.argv)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

async function updateConfluencePage(pageIdNum: number, storage: string, message: string, labels: string[] = []) {
  const page = await getPage(pageIdNum)
  if (labels.length > 0) {
    syncLabels(pageIdNum, labels)
  }
  const result = await editPage(pageIdNum, storage, page.title, page.version + 1, page.space, message)
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
  return imagePaths.map((imagePath) => {
    console.log(`Uploading image: ${imagePath}`)
    try {
      return addAttachment(pageId, imagePath, 'Uploaded by mdconf')
    } catch (error) {
      console.error(`Failed to upload ${imagePath}: ${error.message}`)
      return null
    }
  })
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
    return path.resolve(baseDir, imgPath)
  })
}
