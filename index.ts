import { Command } from 'commander'
import fs from 'fs/promises'
import { convertToConfluence, extractFrontMatter } from './convert.js'
import { editPage, createPage, getPage, markupToStorage, homePage } from './api.js'

const VERSION = '1.2.1'

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
        const result = await convertToConfluence(markdown, {
          outputPath: output,
        })
        if (!output) {
          console.log(result)
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
        const frontmatter = await extractFrontMatter(markdown)
        console.log(frontmatter)
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program
    .command('publish <markup.md>')
    .option('-i, --id <pageId>', 'Confluence Page ID to update')
    .option('-m, --message <message>', 'Message for the update')
    .description('Convert markup to storage format and publish to Confluence page')
    .action(async (markupPath: string, options: { id?: string; message?: string }) => {
      const pageIdNum = options.id ? Number(options.id) : inferPageId(markupPath)
      const message = options.message || ''
      try {
        if (isNaN(pageIdNum)) {
          throw new Error(`Invalid or missing page ID ${options.id}`)
        }
        const markup = await fs.readFile(markupPath, 'utf-8')
        const storage = await markupToStorage(markup)
        const page = await getPage(pageIdNum)
        const result = await editPage(pageIdNum, storage, page.title, page.version + 1, page.space, message)
        console.log(`Published to Confluence: version ${result.version.number}\n${page.tinyui}`)
      } catch (error) {
        console.error(`${error.message}`)
        process.exit(1)
      }
    })

  program
    .command('new <markdown.md>')
    .option('-s, --space <space>', 'Confluence Space Key', '')
    .option('-t , --title <title>', 'Title of the new page (optional, can be in frontmatter)', '')
    .description('Create a new Confluence page from markdown with frontmatter')
    .action(async (markdownPath: string, options: { space: string; title?: string }) => {
      const space = options.space
      if (!space) {
        console.error('Space key is required for creating a new page')
        process.exit(1)
      }
      try {
        const markdown = await fs.readFile(markdownPath, 'utf-8')
        const frontmatter = await extractFrontMatter(markdown)
        const attrs = JSON.parse(frontmatter)
        const title = options.title || (attrs.title as string) || ''
        if (!title) {
          throw new Error('Title is required to create a new page, either via --title or in frontmatter')
        }
        const markup = await convertToConfluence(markdown, { outputPath: undefined })
        const storage = await markupToStorage(markup)
        const homepageData = await homePage(space)
        const ancestorId = homepageData.homepage.id
        const result = await createPage({ title, storage, space, ancestorId })
        console.log(`Created new Confluence page:\n${result._links.base + result._links.tinyui}`)
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
