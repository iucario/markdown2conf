import { convertToConfluence } from '../convert.js'
import { expect, it, describe } from 'vitest'

describe('Nested lists', () => {
  it('should convert complex nested ordered and unordered lists', async () => {
    const md = `1. First item\n2. Second item\n3. Third item\n   1. Nested item 1\n   2. Nested item 2\n4. Fourth item\n\n* Item A\n* Item B\n  * Nested B1\n  * Nested B2\n    * Deep nested\n* Item C`
    const want = `# First item\n# Second item\n# Third item\n## Nested item 1\n## Nested item 2\n# Fourth item\n\n* Item A\n* Item B\n** Nested B1\n** Nested B2\n*** Deep nested\n* Item C\n`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(want.trim())
  })

  it('should convert nested unordered lists', async () => {
    const md = `- Item 1\n  - Subitem 1\n  - Subitem 2\n- Item 2`
    const want = `* Item 1\n** Subitem 1\n** Subitem 2\n* Item 2\n`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(want.trim())
  })

  it('should convert nested ordered lists', async () => {
    const md = `1. Item 1\n   1. Subitem 1\n   1. Subitem 2\n2. Item 2`
    const want = `# Item 1\n## Subitem 1\n## Subitem 2\n# Item 2\n`
    const got = await convertToConfluence(md)
    expect(got.trim()).toBe(want.trim())
  })
})
