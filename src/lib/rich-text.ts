export function isRichTextHtml(content: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function toEditableHtml(content: string): string {
  if (!content) return '';
  if (isRichTextHtml(content)) return content;

  return content
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}
