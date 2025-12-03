import { marked } from 'marked'
import fs from 'fs/promises'
import codeLangMap from './codelang.js'
import fm from 'front-matter'

let headingAnchors = [] // Collect original headings and use them to generate Confluence anchor links
let localImages = [] // Collect images

const extractHeadings = (markdown) => {
  let headings = []
  const tokens = marked.lexer(markdown)

  tokens.forEach((token) => {
    if (token.type === 'heading') {
      headings.push({
        text: token.text,
        depth: token.depth,
        anchor: token.text.toLowerCase().replace(/[^\w]+/g, '-'),
      })
    }
  })

  return headings
}

const confluenceRenderer = {
  heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens)
    return `h${depth}. ${text}\n\n`
  },

  paragraph({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return `${text}\n\n`
  },

  list(body, depth = 1) {
    if (typeof body === 'object' && body.items) {
      let isOrdered = !!body.ordered
      let result = body.items.map((item) => this.listitem(item, isOrdered, depth)).join('')
      return result + '\n' // Ensure one newline after the whole list
    }
    let text = String(body).trim()
    return text + '\n'
  },

  listitem(item, ordered, depth) {
    const marker = ordered ? '#'.repeat(depth) : '*'.repeat(depth)
    let result = marker + ' '

    if (item.tokens) {
      for (const token of item.tokens) {
        if (token.type === 'list') {
          // Nested list
          result += '\n' + this.list(token, depth + 1).trim()
        } else if (token.type === 'code' || token.type === 'blockquote' || token.type === 'table') {
          // Block-level tokens: use parser
          result += '\n' + this.parser.parse([token]).trimEnd()
        } else if (token.tokens) {
          // Inline tokens: use parseInline
          result += this.parser.parseInline(token.tokens)
        } else if (token.type && this[token.type]) {
          result += this[token.type](token)
        } else if ('text' in token) {
          result += token.text
        }
      }
    } else if (item.text) {
      // Fallback for plain text
      result += this.parser.parseInline([{ type: 'text', text: item.text }])
    }

    return result + '\n'
  },

  code({ text, lang }) {
    const { confluenceLang, macroParams } = convertToCodeMacro(lang)

    switch (confluenceLang) {
      case 'mermaid':
        return (
          `{html}\n<pre class="mermaid">\n` +
          `${text}\n</pre>\n` +
          `<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';</script>\n` +
          `{html}\n\n`
        )

      case 'plantuml':
        return `{plantuml}\n${text}\n{plantuml}\n\n`

      default:
        return `{code:${macroParams}}\n${text}\n{code}\n\n`
    }
  },

  blockquote({ tokens }) {
    const text = this.parser.parse(tokens).trim()
    // Detect callout syntax: [!type] Title\nContent (multi-line)
    const calloutRegex = /^\[!(info|warning|tip|note)]\s*(.+)?\n([\s\S]*)$/i
    if (calloutRegex.test(text)) {
      // Split blockquote into lines for multi-callout support
      const lines = text.split(/\n(?=> \[!)/)
      let result = ''
      for (const line of lines) {
        const match = line.match(/^\[!(info|warning|tip|note)]\s*(.+)?\n?([\s\S]*)$/i)
        if (match) {
          const type = match[1].toLowerCase()
          const title = match[2]?.trim() || type.charAt(0).toUpperCase() + type.slice(1)
          const content = match[3].trim()
          result += `{${type}:title=${title}}\n${content}\n{${type}}\n`
        } else {
          // Fallback for unmatched lines
          result += `{quote}\n${line}\n{quote}\n`
        }
      }
      return result
    }
    return `{quote}\n${text}\n{quote}\n`
  },

  table({ header, rows }) {
    let result = ''

    // Header
    result += '||'
    for (const cell of header) {
      const text = this.parser.parseInline(cell.tokens)
      // Add space for empty cells to avoid consecutive pipes
      const cellContent = text.trim() === '' ? ' ' : text
      result += `${cellContent}||`
    }
    result += '\n'

    // Rows
    for (const row of rows) {
      result += '|'
      for (const cell of row) {
        const text = this.parser.parseInline(cell.tokens)
        const cellContent = text.trim() === '' ? ' ' : text
        result += `${cellContent}|`
      }
      result += '\n'
    }

    return result + '\n'
  },

  hr() {
    return '----\n\n'
  },

  html({ text, raw }) {
    // Convert <br>, <br/> to newlines
    if (/^<br\s*\/?>$/i.test(raw?.trim())) {
      return '\n'
    }
    // Output HTML tags as normal text, not rendered as HTML
    return raw || text
  },

  // Inline elements
  strong({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return `*${text}*`
  },

  em({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return `_${text}_`
  },

  del({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return `-${text}-`
  },

  codespan({ text }) {
    let raw = String(text)
    // Escape dashes and curly braces in all code spans
    let escaped = raw.replace(/-/g, '\\-').replace(/\{/g, '\\{').replace(/\}/g, '\\}')
    return `{{${escaped}}}`
  },

  link({ href, tokens }) {
    // Check if it's an image
    if (tokens && tokens[0]?.type === 'image') {
      return this.image({
        href: tokens[0].href,
        title: tokens[0].title,
        text: tokens[0].text,
      })
    }

    // Fix same-page anchor links for Confluence
    if (href.startsWith('#')) {
      // Fallback values
      let anchorText = '#' + href.slice(1).replace(/\s/g, '')
      let linkText = '#' + href.slice(1).replace(/-/g, ' ')
      // Find heading by markdown anchor (case-insensitive)
      for (const heading of headingAnchors) {
        const markdownAnchor = '#' + heading.anchor
        if (markdownAnchor === href.toLowerCase()) {
          // Confluence anchor: remove spaces only, preserve dashes and case
          anchorText = '#' + heading.text.replace(/\s/g, '')
          // Link text: original heading, prefixed with #, preserve case and spacing
          linkText = '#' + heading.text.trim()
          break
        }
      }
      return `[${linkText}|${anchorText}]`
    }

    // Default: use parsed inline text
    const text = this.parser.parseInline(tokens)
    return `[${text}|${href}]`
  },

  image({ href, text }) {
    // Only collect local image paths for upload
    let src = href
    const isUrl = /^https?:\/\//.test(href)
    if (!isUrl) {
      // For local images, decode URL encoding and get just the filename for Confluence display
      src = decodeURIComponent(src.split('/').pop().split('?')[0])
      localImages.push(href) // Keep original href for file path resolution
    }
    if (text && text.trim()) {
      return `!${src}|alt=${text.trim()}!`
    }
    return `!${src}!`
  },

  br() {
    return '\n'
  },

  text({ text }) {
    return text
  },
}

/**
 * Converts markdown to Confluence wiki markup and collects local image paths.
 * @param {string} markdown - The markdown content to convert.
 * @param {object} [options] - Optional conversion options.
 * @returns {Promise<{markup: string, localImages: string[]}>} The Confluence markup and local image paths.
 */
async function convertToConfluence(markdown, options = {}) {
  try {
    // Use front-matter to extract body
    const { body } = fm(markdown)
    headingAnchors = [] // Reset before each parse
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false,
      smartypants: false,
      ...options.markedOptions,
    })
    marked.use({ renderer: confluenceRenderer })
    headingAnchors = extractHeadings(body)
    const markup = marked.parse(body)

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, markup, 'utf-8')
      console.log(`Saved to: ${options.outputPath}`)
    }

    return { markup, localImages }
  } catch (error) {
    throw new Error(`Failed to convert: ${error.message}`)
  }
}

async function extractFrontMatter(markdown) {
  const { attributes } = fm(markdown)

  if (!Object.keys(attributes).length) {
    return {
      title: null,
      labels: [],
      id: null,
    }
  }

  return {
    title: attributes.title || null,
    labels: Array.isArray(attributes.labels) ? attributes.labels : [],
    id: attributes.id || null,
    ...attributes,
  }
}

/**
 *
 * @param {string} langStr
 * @returns {{confluenceLang: string, macroParams: string}}
 */
function convertToCodeMacro(langStr) {
  const allowedParams = ['title', 'theme', 'linenumbers', 'firstline', 'collapse']
  const attrMatch = langStr.match(/^(\w+)?\s*\{([^}]+)\}/)
  const language = attrMatch ? attrMatch[1] || '' : langStr.match(/^(\w+)/)?.[1] || ''
  const confluenceLang = codeLangMap[language] || 'none'

  const params = [`lang=${confluenceLang}`]
  if (attrMatch) {
    attrMatch[2].split(',').forEach((attr) => {
      const match = attr.trim().match(/^(\w+)=["']([^"']+)["']$/)
      if (match && allowedParams.includes(match[1])) {
        params.push(`${match[1]}=${match[2]}`)
      }
    })
  }
  return { confluenceLang, macroParams: params.join('|') }
}

export { convertToConfluence, convertToCodeMacro, confluenceRenderer, extractFrontMatter }
