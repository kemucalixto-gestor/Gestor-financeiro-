export function parseTags(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const arr = JSON.parse(input);
    if (Array.isArray(arr)) {
      return arr
        .filter((x): x is string => typeof x === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function stringifyTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const cleaned = Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ).slice(0, 10);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}

export function tagsFromInput(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
