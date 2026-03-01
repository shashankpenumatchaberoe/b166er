/**
 * Extracts the last meaningful message from a raw terminal buffer.
 * Strips ANSI escape codes, trims trailing shell prompts and blank lines,
 * then returns the last non-empty paragraph of text.
 */
export function extractFinalMessage(rawBuffer: string): string {
  const stripped = rawBuffer
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\][^\x07]*\x07/g, '')
    .replace(/\r/g, '');

  const lines = stripped.split('\n');

  // Walk back past trailing empty lines and bare shell prompts ($ > % #)
  let end = lines.length - 1;
  while (end >= 0 && /^\s*[\$>%#]?\s*$/.test(lines[end])) {
    end--;
  }

  if (end < 0) return '';

  // Walk back to the start of the last contiguous non-empty block
  let start = end;
  while (start > 0 && lines[start - 1].trim() !== '') {
    start--;
  }

  return lines.slice(start, end + 1).join('\n').trim();
}
