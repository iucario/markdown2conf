import { describe, it, expect } from 'vitest'
import { convertToConfluence, extractFrontMatter } from '../index.js'

describe('Complex Confluence Markup', () => {
  it('converts complex tables', async () => {
    const md = `| Feature | Pros | Cons |
|---|---|---|
| Markdown | __Simple__ | *Limited features*  |
| Confluence | Rich \`formatting\` ~~Tables~~ Macros | Proprietary Complex |`
    const conf = await convertToConfluence(md)
    expect(conf.trim()).toBe(
      `||Feature||Pros||Cons||
|Markdown|*Simple*|_Limited features_|
|Confluence|Rich {{formatting}} -Tables- Macros|Proprietary Complex|`
    )
  })

  it('converts mermaid to html macro', async () => {
    const md = '```mermaid\ngraph TD;\nA-->B;\nA-->C;\nB-->D;\nC-->D;\n```'
    const conf = await convertToConfluence(md)
    expect(conf.trim()).toBe(
      `{html}
<pre class="mermaid">\ngraph TD;\nA-->B;\nA-->C;\nB-->D;\nC-->D;\n</pre>
<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';</script>
{html}`
    )
  })

  it('converts html to html macro', async () => {
    const md = `<div style="color: red;">This is a red div</div>`
    const conf = await convertToConfluence(md)
    expect(conf.trim()).toBe(
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
    const conf = await convertToConfluence(md)
    expect(conf.trim()).toBe('h1. heading 1')
  })
})
