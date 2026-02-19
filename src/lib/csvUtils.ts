import { toLocalISODate } from './helpers';

/**
 * Decode CSV text from ArrayBuffer with simple encoding detection.
 * Prefer UTF-8 when it introduces fewer replacement characters.
 */
export function decodeCSVBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

  const decodeTry = (enc: string) => {
    try {
      return new TextDecoder(enc).decode(buf);
    } catch {
      return '';
    }
  };

  let text: string;
  if (hasUtf8Bom) {
    text = decodeTry('utf-8');
  } else {
    const eucKr = decodeTry('euc-kr');
    const utf8 = decodeTry('utf-8');
    const eucGarbled = (eucKr.match(/\uFFFD/g) || []).length;
    const utf8Garbled = (utf8.match(/\uFFFD/g) || []).length;
    text = utf8Garbled <= eucGarbled ? utf8 : eucKr;
  }

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/**
 * Convert date-like values to YYYY-MM-DD.
 * Supports Date, Excel serial date, and common date string formats.
 */
export function toISODate(v: unknown, XLSX?: any): string {
  if (v === null || v === undefined || v === '') return toLocalISODate();
  if (v instanceof Date) return toLocalISODate(v);

  if (typeof v === 'number' && XLSX?.SSF) {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.y && d.m && d.d) {
        return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch {
      // ignore parse errors
    }
  }

  const s = String(v).trim();
  const dtMatch = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (dtMatch) {
    return `${dtMatch[1]}-${String(parseInt(dtMatch[2], 10)).padStart(2, '0')}-${String(parseInt(dtMatch[3], 10)).padStart(2, '0')}`;
  }

  return toLocalISODate();
}

/**
 * Parse amount text into a number.
 */
export function parseAmount(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

