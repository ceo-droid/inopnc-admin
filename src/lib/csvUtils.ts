/**
 * CSV 파일 인코딩 자동 감지 및 텍스트 변환 유틸리티
 * HomeView, ExpenseView 등에서 공통 사용
 */

/**
 * ArrayBuffer를 인코딩 감지하여 문자열로 변환
 * UTF-8 BOM → UTF-8, 그 외 → EUC-KR vs UTF-8 비교하여 깨짐 적은 쪽 선택
 */
export function decodeCSVBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;

  const decodeTry = (enc: string) => {
    try { return new TextDecoder(enc).decode(buf); } catch { return ''; }
  };

  let text: string;
  if (hasUtf8Bom) {
    text = decodeTry('utf-8');
  } else {
    const eucKr = decodeTry('euc-kr');
    const utf8 = decodeTry('utf-8');
    const eucGarbled = (eucKr.match(/�/g) || []).length;
    const utf8Garbled = (utf8.match(/�/g) || []).length;
    text = utf8Garbled <= eucGarbled ? utf8 : eucKr;
  }

  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
}

/**
 * 날짜 문자열을 ISO 형식(YYYY-MM-DD)으로 변환
 * 엑셀 날짜 코드, "2025-01-01 00:00:00", 한국어 날짜 등 지원
 */
export function toISODate(v: unknown, XLSX?: any): string {
  if (v === null || v === undefined || v === '') return new Date().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && XLSX?.SSF) {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.y && d.m && d.d) {
        return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch { /* ignore */ }
  }
  const s = String(v).trim();
  const dtMatch = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (dtMatch) return `${dtMatch[1]}-${String(parseInt(dtMatch[2])).padStart(2, '0')}-${String(parseInt(dtMatch[3])).padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

/**
 * 금액 문자열을 숫자로 파싱 (쉼표 제거)
 */
export function parseAmount(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
