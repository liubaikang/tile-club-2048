/**
 * Slug used for both the table of contents and heading anchors so both stay in sync.
 * Keeps CJK characters, lowercases ASCII, collapses punctuation into single dashes.
 */
export const slugify = (text: string): string =>
  text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

export interface TocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}

/** Reads `##`/`###` headings straight from the markdown source. */
export const buildToc = (markdown: string): TocEntry[] =>
  markdown
    .split('\n')
    .map((line) => {
      const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      const label = match[2].replace(/\*\*/g, '').replace(/`/g, '').trim();
      return {
        id: slugify(label),
        label,
        level: (match[1].length === 2 ? 2 : 3) as 2 | 3,
      };
    })
    .filter((entry): entry is TocEntry => entry !== null);