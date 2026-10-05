export const SEARCH_RESULT_LIMIT = 100;

export const SEARCH_FALLBACK_CENTER = {
  latitude: 6.5244,
  longitude: 3.3792,
};

const TSQLY_OPERATOR_CHARS = /[&|!():]+/g;

export function sanitizeSearchTerm(input: string): string {
  return input.replace(TSQLY_OPERATOR_CHARS, " ").replace(/\s+/g, " ").trim();
}
