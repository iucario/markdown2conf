# Markdown2conf

Convert Markdown files to Confluence Wiki Markup with CLI and frontmatter extraction support.

## Features

- Converts Markdown to Confluence Wiki Markup
- Supports tables, code blocks, callouts, links, and more
- Extracts YAML frontmatter (title, labels) from Markdown files
- CLI usage for easy integration

## Installation

Install packages

```sh
pnpm install
```

Optionally install executable globally as `mdconf`

```sh
pnpm build
pnpm link --global
```

## Usage

### Convert Markdown to Confluence markup

```sh
pnpm dev test/demo.md <output>
```

If `output` is provided, saves the result to a file. Otherwise, prints to stdout.

### Extract frontmatter (title, labels)

```sh
pnpm dev frontmatter test/demo.md
```

```json
{
  "title": "Page Title",
  "labels": [ "test", "markdown", "confluence", "typescript" ]
}
```

Prints the parsed frontmatter as a JSON object.

### Create New Page

```sh
mdconf create input.md -s '~your.name'
```

### Help

```sh
pnpm dev --help
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
import { convertToConfluence, extractFrontMatter } from 'markdown2conf'

const md = '# Title\n```py\nprint('hello')\n```\n'
const conf = await convertToConfluence(md)
const frontmatter = await extractFrontMatter(md)
```

## License

MIT
