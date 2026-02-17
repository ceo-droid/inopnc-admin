/**
 * 경비 CSV의 약칭/비공식 현장명을 DB의 정식 현장명과 자동 매칭하는 유틸리티
 * 
 * 매칭 전략:
 * 1. 정확 일치 (trim 후)
 * 2. 정규화 후 일치 (공백, 특수문자, 줄바꿈 제거)
 * 3. 약칭 확장 매칭 (BL→블럭 등)
 * 4. 키워드 기반 점수 매칭
 */

// 약칭 → 정식 변환 맵
const ABBREVIATIONS: Record<string, string[]> = {
  'BL': ['블럭', '블록'],
  '블럭': ['BL', '블록'],
  'HS': ['힐스테이트'],
  '힐스': ['힐스테이트'],
  'PC': ['PC'],
  'SK': ['SK'],
  'HD': ['현대', 'HD'],
  '현건': ['현대건설'],
  '현엔': ['현대엔지니어링'],
  'CUB': ['CUB'],
  'IBL': ['IBL'],
  'OBL': ['OBL'],
};

/**
 * 현장명 정규화: 공백, 줄바꿈, 특수문자 제거 후 소문자 변환
 */
function normalize(name: string): string {
  return name
    .replace(/[\s\n\r\t]+/g, '') // 모든 공백/줄바꿈 제거
    .replace(/[()（）\[\]【】「」『』<>《》,，.。·\-_/\\'"'""`~!@#$%^&*+=|;:：]/g, '') // 특수문자 제거
    .toLowerCase();
}

/**
 * 키워드 추출: 의미있는 단어들을 분리
 */
function extractKeywords(name: string): string[] {
  // 원본에서 공백, 줄바꿈으로 분리
  const raw = name.replace(/[\n\r]+/g, ' ').trim();
  
  // 괄호 내용도 별도 키워드로 추출
  const parenthetical = [...raw.matchAll(/[（(]([^）)]+)[）)]/g)].map(m => m[1].trim());
  
  // 괄호 제거 후 분리
  const cleaned = raw.replace(/[（(][^）)]*[）)]/g, ' ');
  
  // 숫자+단위, 한글단어, 영문단어로 분리
  const words = cleaned.match(/[\d]+[가-힣a-zA-Z]+|[가-힣]{2,}|[a-zA-Z]{2,}|[\d]+/g) || [];
  
  return [...words, ...parenthetical]
    .map(w => w.trim())
    .filter(w => w.length >= 2)
    // 불필요한 일반 단어 제거
    .filter(w => !['지하주차장', 'PC부재', '보수', '공사', '보수공사', '마감보수', '균열보수', '주식회사'].includes(w));
}

/**
 * 두 문자열의 유사도 점수 계산 (0~1)
 */
function similarityScore(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  
  // 정확 일치
  if (normA === normB) return 1.0;
  
  // 포함 관계
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = Math.min(normA.length, normB.length);
    const longer = Math.max(normA.length, normB.length);
    return 0.7 + (shorter / longer) * 0.2;
  }
  
  // 약칭 확장 후 비교
  let expandedA = normA;
  let expandedB = normB;
  for (const [abbr, expansions] of Object.entries(ABBREVIATIONS)) {
    const abbrLower = abbr.toLowerCase();
    for (const exp of expansions) {
      const expLower = exp.toLowerCase();
      expandedA = expandedA.replace(new RegExp(abbrLower, 'g'), expLower);
      expandedB = expandedB.replace(new RegExp(abbrLower, 'g'), expLower);
    }
  }
  if (expandedA.includes(expandedB) || expandedB.includes(expandedA)) {
    return 0.6;
  }
  
  // 키워드 기반 점수
  const kwA = extractKeywords(a);
  const kwB = extractKeywords(b);
  if (kwA.length === 0 || kwB.length === 0) return 0;
  
  let matchCount = 0;
  for (const kw of kwA) {
    const kwNorm = normalize(kw);
    if (kwB.some(kb => {
      const kbNorm = normalize(kb);
      return kbNorm.includes(kwNorm) || kwNorm.includes(kbNorm);
    })) {
      matchCount++;
    }
  }
  
  const coverage = matchCount / Math.max(kwA.length, kwB.length);
  return coverage * 0.5;
}

export interface MatchResult {
  siteId: string;
  siteName: string;
  score: number;
}

/**
 * 경비 CSV 현장명에 대해 가장 적합한 DB 현장을 찾음
 * @param expenseSiteName CSV에서 읽은 현장명
 * @param sites DB의 현장 목록 [{id, name}]
 * @param threshold 최소 매칭 점수 (기본 0.3)
 * @returns 매칭 결과 또는 null
 */
export function findBestMatch(
  expenseSiteName: string,
  sites: { id: string; name: string }[],
  threshold = 0.3
): MatchResult | null {
  if (!expenseSiteName.trim()) return null;
  
  let bestMatch: MatchResult | null = null;
  
  for (const site of sites) {
    const score = similarityScore(expenseSiteName, site.name);
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { siteId: site.id, siteName: site.name, score };
    }
  }
  
  return bestMatch;
}

/**
 * 현장명 매핑 테이블을 한번에 구축 (대량 처리용)
 * @param expenseNames CSV에서 추출한 고유 현장명 목록
 * @param sites DB 현장 목록
 * @returns Map<expenseName, siteId>
 */
export function buildSiteNameMap(
  expenseNames: string[],
  sites: { id: string; name: string }[],
  threshold = 0.3
): Map<string, string> {
  const mapping = new Map<string, string>();
  
  for (const name of expenseNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    
    const match = findBestMatch(trimmed, sites, threshold);
    if (match) {
      mapping.set(trimmed, match.siteId);
    }
  }
  
  return mapping;
}
