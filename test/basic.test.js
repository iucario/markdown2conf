import { describe, it, expect } from 'vitest'
import { convertToConfluence } from '../convert.js'

describe('Basic Confluence Markup', () => {
  it('converts bold text', async () => {
    const md = '**bold**'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe('*bold*')
  })

  it('converts italic text', async () => {
    const md = '*italic*'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe('_italic_')
  })

  it('converts headings', async () => {
    const md = '# Heading 1\n## Heading 2'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('h1. Heading 1\n\nh2. Heading 2\n\n')
  })

  it('converts links', async () => {
    const md = `[link](https://example.org)
<https://example.org>
[#heading 5](#heading-5)
[#Test Lists](#test-lists)
[#Heading-With Dash](#heading-with-dash)

### Test Lists
#### Heading-With Dash
##### heading 5
`
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(`[link|https://example.org]
[https://example.org|https://example.org]
[#heading 5|#heading5]
[#Test Lists|#TestLists]
[#Heading-With Dash|#Heading-WithDash]

h3. Test Lists

h4. Heading-With Dash

h5. heading 5`)
  })

  it('converts images', async () => {
    const md = '![alt text](./image.png)\n![](https://example.org/image.png)'
    const { markup: got } = await convertToConfluence(md)
    const want = '!image.png|alt=alt text!\n!https://example.org/image.png!'
    expect(got.trim()).toBe(want)
  })

  it('converts local images with URI encoded paths', async () => {
    const md = '![alt text](./image%20name.png)\n![](https://example.org/image%20name.png)'
    const { markup: got } = await convertToConfluence(md)
    const want = '!image name.png|alt=alt text!\n!https://example.org/image%20name.png!'
    expect(got.trim()).toBe(want)
  })

  it('converts unordered lists', async () => {
    const md = '- item1\n- item2'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('* item1\n* item2\n\n')
  })

  it('converts ordered lists', async () => {
    const md = '1. item1\n2. item2'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('# item1\n# item2\n\n')
  })

  it('converts check lists to unorderd list', async () => {
    const md = '- [x] done\n- [ ] not done'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('* done\n* not done\n\n')
  })

  it('converts code blocks', async () => {
    const md = '```js\nconsole.log(1);\n```\n```sh\nls -ahl\n```'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('{code:lang=javascript}\nconsole.log(1);\n{code}\n\n{code:lang=bash}\nls -ahl\n{code}\n\n')
  })

  it('converts inline code', async () => {
    const md = 'Here is some `inline code` example.'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe('Here is some {{inline code}} example.')
  })

  it('converts blockquotes', async () => {
    const md = '> This is a blockquote.\n> It has two lines.'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('{quote}\nThis is a blockquote.\nIt has two lines.\n{quote}\n')
  })

  it('converts horizontal rules', async () => {
    const md = '---'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe('----')
  })

  it('converts tables', async () => {
    const md = `| Header 1 | Header 2 |
|---|---|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('||Header 1||Header 2||\n' + '|Cell 1|Cell 2|\n' + '|Cell 3|Cell 4|\n\n')
  })

  it('converts tables with empty cell', async () => {
    const md = `|| Header 2 |
|---|---|
| Cell 1   | Cell 2   |
| Cell 3   ||`
    const { markup: conf } = await convertToConfluence(md)
    expect(conf).toBe('|| ||Header 2||\n' + '|Cell 1|Cell 2|\n' + '|Cell 3| |\n\n')
  })

  it('converts callouts', async () => {
    const md = `> [!INFO] Info
> Call out

> [!warning] Warning
> Call out

> [!tip] Tip
> Call out
>
> Multiple lines

> [!note] Note
> Call out`
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(`{info:title=Info}
Call out
{info}
{warning:title=Warning}
Call out
{warning}
{tip:title=Tip}
Call out

Multiple lines
{tip}
{note:title=Note}
Call out
{note}`)
  })

  it('should not convert styles inside code spans', async () => {
    const md = 'This is `**not bold**` text.\nThis is `abc-not strike-def` text.'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe('This is {{**not bold**}} text.\nThis is {{abc\\-not strike\\-def}} text.')
  })

  it('escapes confluence markup styles in text', async () => {
    const md = 'This is `abc-not strike-def` text.'
    const want = 'This is {{abc\\-not strike\\-def}} text.'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(want)
  })

  it('escapes confluence curly braces in code', async () => {
    const md = `This is {normal} text.
This is code span \`{var}blahblah{var}\`
This is code block
\`\`\`sh
echo {var}
\`\`\``
    const want = `This is {normal} text.
This is code span {{\\{var\\}blahblah\\{var\\}}}
This is code block

{code:lang=bash}
echo {var}
{code}`
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(want)
  })

  it('should escape unknown angle brackets in text', async () => {
    const md = 'This is a <test> of angle brackets.\nThis is a <div>Expand</div> test.'
    const want = 'This is a <test> of angle brackets.\nThis is a <div>Expand</div> test.'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(want)
  })

  it('shuould convert <br> tags to new lines', async () => {
    const md = 'Line 1<br>Line 2<br/>Line 3<br />Line 4'
    const want = 'Line 1\nLine 2\nLine 3\nLine 4'
    const { markup: conf } = await convertToConfluence(md)
    expect(conf.trim()).toBe(want)
  })
})
