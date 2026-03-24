import { describe, it, expect } from 'vitest';
import { extractFrontmatter } from './frontmatter.js';

describe('extractFrontmatter', () => {
  it('extracts valid YAML frontmatter', () => {
    const input = `---
title: My Note
tags: [typescript, testing]
date: 2026-03-23
---
# Hello World

Some content here.`;

    const result = extractFrontmatter(input);

    expect(result.frontmatter['title']).toBe('My Note');
    expect(result.frontmatter['date']).toBe('2026-03-23');
    expect(result.body).toBe('# Hello World\n\nSome content here.');
    expect(result.tags).toContain('typescript');
    expect(result.tags).toContain('testing');
    expect(result.title).toBe('My Note');
  });

  it('returns empty frontmatter when none present', () => {
    const input = '# Just a heading\n\nSome text.';
    const result = extractFrontmatter(input);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(input);
    expect(result.tags).toEqual([]);
    expect(result.title).toBeNull();
  });

  it('handles malformed YAML gracefully', () => {
    const input = `---
title: [invalid yaml
  broken: {
---
Content after bad frontmatter.`;

    const result = extractFrontmatter(input);

    // Malformed YAML — should return full text as body
    expect(result.body).toBe(input);
    expect(result.frontmatter).toEqual({});
  });

  it('handles frontmatter with string tags (comma-separated)', () => {
    const input = `---
tags: react, hooks, state
---
Body text`;

    const result = extractFrontmatter(input);

    expect(result.tags).toContain('react');
    expect(result.tags).toContain('hooks');
    expect(result.tags).toContain('state');
  });

  it('handles frontmatter tags with # prefix (quoted)', () => {
    const input = `---
tags: ["#typescript", "#testing"]
---
Body`;

    const result = extractFrontmatter(input);

    expect(result.tags).toContain('typescript');
    expect(result.tags).toContain('testing');
    // Should not contain the # prefix
    expect(result.tags).not.toContain('#typescript');
  });

  it('extracts inline #tags from body', () => {
    const input = `---
tags: [frontmatter-tag]
---
This has #inline-tag and #another-tag in the body.`;

    const result = extractFrontmatter(input);

    expect(result.tags).toContain('frontmatter-tag');
    expect(result.tags).toContain('inline-tag');
    expect(result.tags).toContain('another-tag');
  });

  it('does not extract #tags from code blocks', () => {
    const input = `Some text #real-tag

\`\`\`typescript
const x = #not-a-tag;
\`\`\`

And \`#also-not-a-tag\` in inline code.`;

    const result = extractFrontmatter(input);

    expect(result.tags).toContain('real-tag');
    expect(result.tags).not.toContain('not-a-tag');
    expect(result.tags).not.toContain('also-not-a-tag');
  });

  it('deduplicates tags from frontmatter and inline', () => {
    const input = `---
tags: [shared-tag]
---
Also mentions #shared-tag inline.`;

    const result = extractFrontmatter(input);

    const count = result.tags.filter((t) => t === 'shared-tag').length;
    expect(count).toBe(1);
  });

  it('handles empty frontmatter block', () => {
    const input = `---
---
Just body content.`;

    const result = extractFrontmatter(input);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Just body content.');
  });

  it('extracts aliases and custom properties', () => {
    const input = `---
title: Meeting Notes
aliases: [standup, daily]
custom_field: some value
---
Body`;

    const result = extractFrontmatter(input);

    expect(result.frontmatter['aliases']).toEqual(['standup', 'daily']);
    expect(result.frontmatter['custom_field']).toBe('some value');
  });

  it('does not treat --- in body as frontmatter delimiter', () => {
    const input = `No frontmatter here.

---

This is a horizontal rule, not frontmatter.`;

    const result = extractFrontmatter(input);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(input);
  });
});
