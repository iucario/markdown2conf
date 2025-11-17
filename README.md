# Markdown2conf

Convert Markdown files to Confluence Wiki Markup and publish to Confluence with CLI.

If you encounter any problems or have suggestions, feel free to raise an issue on GitHub.

## Features

- Converts Markdown to Confluence Wiki Markup
- Supports tables, code blocks, callouts, images, mermaid and more
- Extracts YAML frontmatter (title, labels, id) from Markdown files
- CLI usage for easy integration
- Confluence macro tags are preserved without escaping, allowing native macros to function as intended

Supported syntax:

Bold, Italic, Strike, Codespan, Code block, Links, Anchor links, Lists, Nested lists, Tables, Horizontal rules, Callouts, Quotes

Mermaid. Using HTML and mermaid.js

Image. Supports uploading attachments

## Installation

Install from npm:

```sh
npm i -g markdown2conf
mdconf -V
```

Install from source code:

```sh
pnpm build
pnpm link --global
mdconf -V
```

## Usage

Create a config file at `~/.config/mdconf.json`

```json
{
  "confluenceToken": "abcdef",
  "host": "http://localhost"
}
```

### Convert Markdown to Confluence markup

```sh
mdconf test/demo.md <output>
```

If `output` is provided, saves the result to a file. Otherwise, prints to stdout.

### Extract frontmatter (title, labels)

```sh
mdconf frontmatter test/demo.md
```

```json
{
  "title": "Page Title",
  "labels": [ "test", "markdown", "confluence", "typescript" ]
}
```

Prints the parsed frontmatter as a JSON object.

### Create New Page

Creates a page under the space's home page.

```sh
mdconf new input.md -s '~your.name' -t 'title'
```

### Publish Page

```sh
mdconf publish markdown.md -i <id> -m 'message'
```

### Help

```sh
mdconf --help
```

```text
mdconf -h
Usage: mdconf [options] [command] <input.md> [output.confluence]

Markdown to Confluence Wiki Markup Converter

Arguments:
  input.md                             Markdown input file
  output.confluence                    Output file (optional)

Options:
  -V, --version                        output the version number
  -h, --help                           display help for command

Commands:
  frontmatter <input.md>               Extract frontmatter (id, title, labels)
  publish|pub [options] <markdown.md>  Convert markdown/markup to storage format and publish to Confluence page
  new [options] <markdown.md>          Create a new Confluence page from markdown with frontmatter
```

## Example

Markdown:

```markdown
---
title: My Page
labels:
  - docs
  - confluence
---

# Welcome
This is a sample page.
```

Command:

```sh
mdconf sample.md
```

## API

You can also use the library programmatically:

```js
import { convertToConfluence } from './convert.js'

const md = '# Title\n```py\nprint('hello')\n```\n'
const { markup, localImages } = await convertToConfluence(markdown, { outputPath: null })
```

## How Does It Work

It overrides the Renderer functions of [Marked](https://github.com/markedjs/marked) to produce Confluence wiki markup.

## License

MIT
