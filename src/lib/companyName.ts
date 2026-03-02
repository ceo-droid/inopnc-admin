export const SPECIAL_COMPANY_CANONICAL = '\uC0BC\uD45C\uD53C\uC564\uC528 \uC8FC\uC2DD\uD68C\uC0AC';
const SPECIAL_COMPANY_ALIAS = '\uC0BC\uD45C\uD53C\uC564\uC528';

export const normalizeCompanyName = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const SPECIAL_COMPANY_KEYS = new Set<string>([
  normalizeCompanyName(SPECIAL_COMPANY_ALIAS),
  normalizeCompanyName(SPECIAL_COMPANY_CANONICAL),
]);

export const isSpecialCompanyName = (name: string) =>
  SPECIAL_COMPANY_KEYS.has(normalizeCompanyName(name));

export const canonicalizeCompanyName = (name: string) => {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return isSpecialCompanyName(raw) ? SPECIAL_COMPANY_CANONICAL : raw;
};

export const findSimilarCompanyName = (input: string, names: string[], minToken = 3) => {
  const canonicalInput = canonicalizeCompanyName(input);
  const normalizedInput = normalizeCompanyName(canonicalInput);
  if (!normalizedInput) return '';

  let bestMatch = '';
  let bestMatchLen = -1;

  for (const name of names) {
    const candidate = canonicalizeCompanyName(name);
    const key = normalizeCompanyName(candidate);
    if (!key) continue;

    if (key === normalizedInput) return candidate;

    if (normalizedInput.length < minToken || Math.min(key.length, normalizedInput.length) < minToken) {
      continue;
    }

    if (key.includes(normalizedInput) || normalizedInput.includes(key)) {
      if (key.length > bestMatchLen) {
        bestMatch = candidate;
        bestMatchLen = key.length;
      }
    }
  }

  return bestMatch;
};
