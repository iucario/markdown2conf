import { describe, it, expect } from 'vitest'
import { convertToConfluence, extractFrontMatter } from '../convert.js'

describe('Complex Confluence Markup', () => {
  it('converts complex tables', async () => {
    const md = `| Feature | Pros | Cons |
|---|---|---|
| Markdown | __Simple__ | *Limited features*  |
| Confluence | Rich \`formatting\` ~~Tables~~ Macros | Proprietary Complex |`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(
      `||Feature||Pros||Cons||
|Markdown|*Simple*|_Limited features_|
|Confluence|Rich {{formatting}} -Tables- Macros|Proprietary Complex|`
    )
  })

  it('converts mermaid to html macro', async () => {
    const md = '```mermaid\ngraph TD;\nA-->B;\nA-->C;\nB-->D;\nC-->D;\n```'
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(
      `{html}
<pre class="mermaid">\ngraph TD;\nA-->B;\nA-->C;\nB-->D;\nC-->D;\n</pre>
<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';</script>
{html}`
    )
  })

  it('converts html to html macro', async () => {
    const md = `<div style="color: red;">This is a red div</div>`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(
      `{html}<div style="color: red;">This is a red div</div>{html}`
    )
  })

  it('extracts YAML front matter', async () => {
    const md = `---
title: 'Page Title'
labels:
  - test
  - markdown
  - confluence
  - typescript
---

# heading 1
`
    const frontmatter = await extractFrontMatter(md)
    expect(frontmatter).toStrictEqual({
      title: 'Page Title',
      labels: ['test', 'markdown', 'confluence', 'typescript'],
    })
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe('h1. heading 1')
  })

  it('convert styles inside lists', async () => {
    const md = `1. **Bold Item**
2. _Italic Item_
3. \`Code Item\`
4. ~~Strikethrough Item~~
5. Mixed **Bold** and _Italic_ and \`Code\` and ~~Strikethrough~~
`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(
      `# *Bold Item*
# _Italic Item_
# {{Code Item}}
# -Strikethrough Item-
# Mixed *Bold* and _Italic_ and {{Code}} and -Strikethrough-`
    )
  })

  it('convert code inside lists', async () => {
    const md = `1. Item with inline code \`inlineCode()\`
2. Item with code blockquote
    \`\`\`javascript
    function test() {
      console.log("Hello, World!");
    }
    \`\`\``
    const want = `# Item with inline code {{inlineCode()}}
# Item with code blockquote
{code:lang=javascript}
function test() {
  console.log("Hello, World!");
}
{code}`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(want)
  })

  it('convert block elements inside lists', async () => {
    const md = `
1. Item with blockquote
    > This is a blockquote inside a list item.
    >
    > It has multiple lines.
2. Item with table
    | Header 1 | Header 2 |
    |----------|----------|
    | Cell 1   | Cell 2   |
    | Cell 3   | Cell 4   |`
    const want = `
# Item with blockquote
{quote}
This is a blockquote inside a list item.

It has multiple lines.
{quote}

# Item with table
||Header 1||Header 2||
|Cell 1|Cell 2|
|Cell 3|Cell 4|`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(want.trim())
  })
})
