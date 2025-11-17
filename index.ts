#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'fs/promises'
import { createPage, homePage, markupToStorage, syncLabels } from './api.js'
import { convertToConfluence, extractFrontMatter } from './convert.js'
import { inferPageId, mdToStorage, relativePaths, updateConfluencePage, upploadImages } from './main.js'

const VERSION = '1.4.13-rc.1'

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
    .description('Extract frontmatter (id, title, labels)')
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
            await updateConfluencePage({ pageId: pageIdNum, storage, message })
          } else {
            const markdown = await fs.readFile(filePath, 'utf-8')
            const attrs = await extractFrontMatter(markdown)
            const pageIdNum = options.id ? Number(options.id) : attrs.id ? Number(attrs.id) : 0
            if (isNaN(pageIdNum) || pageIdNum <= 0) {
              throw new Error(`Invalid or missing page ID ${options.id || attrs.id}`)
            }
            const labels = attrs.labels || []
            const { title, storage, localImages } = await mdToStorage(filePath, {})
            const newTitle = attrs.title || title || null
            await updateConfluencePage({ pageId: pageIdNum, storage, message, labels, title: newTitle })
            if (options.attachment && localImages.length > 0) {
              const relativeImagePaths = relativePaths(filePath, localImages)
              await upploadImages(pageIdNum, relativeImagePaths)
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
          await upploadImages(result.id, relativeImagePaths)
        }
        const attrs = await extractFrontMatter(await fs.readFile(filePath, 'utf-8'))
        if (attrs.labels && attrs.labels.length > 0) {
          await syncLabels(result.id, attrs.labels)
        }
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program.parse(process.argv)
}

main()
