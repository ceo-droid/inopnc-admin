export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(amount);
};

export const calcPayroll = (daily: number, md: number) => {
  const gross = (daily || 0) * (md || 0);
  const tax = Math.floor(gross * 0.033);
  const net = gross - tax;
  return { gross, tax, net };
};

export const normalizeText = (v: unknown) => String(v ?? '').replace(/\uFEFF/g, '').trim();

export const int = (v: unknown, fallback = 0) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

export const num = (v: unknown, fallback = 0) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const toLocalISODate = (date: Date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseISODateLocal = (value: string) => {
  const s = normalizeText(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const parseKoreanDateToISO = (raw: string) => {
  const s = normalizeText(raw);
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    let y = int(m[1]);
    if (y < 100) y = 2000 + y;
    const mm = int(m[2]);
    const dd = int(m[3]);
    if (y >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toLocalISODate(d);
  return '';
};

export const median = (arr: number[]) => {
  const a = arr.filter(n => Number.isFinite(n)).slice().sort((x, y) => x - y);
  if (a.length === 0) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
};

export const formatMd = (md: number) => {
  if (!Number.isFinite(md)) return '0';
  return Number.isInteger(md) ? md.toFixed(0) : md.toFixed(1);
};

export const formatCurrencyShort = (amount: number) => {
  const a = Math.abs(amount || 0);
  if (a >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (a >= 10000) return `${(amount / 10000).toFixed(0)}만`;
  if (a >= 1000) return `${(amount / 1000).toFixed(0)}천`;
  return `${formatCurrency(amount)}원`;
};

type SiteColorTheme = {
  header: string;
  border: string;
  hue: number;
};

const buildDarkSiteTone = (hue: number) => {
  const h = ((hue % 360) + 360) % 360;
  const saturation = 46;
  const lightness = 31;

  return {
    bg: `hsl(${h} ${saturation}% ${lightness}%)`,
    ring: `hsl(${h} ${Math.max(saturation - 6, 30)}% ${Math.min(lightness + 22, 78)}%)`,
    text: '#f5f7fa',
  };
};

export const SITE_COLOR_THEMES: SiteColorTheme[] = [
  { header: 'bg-slate-100/55 text-slate-900', border: 'border-slate-300', hue: 215 },
  { header: 'bg-sky-100/55 text-sky-950', border: 'border-sky-200', hue: 202 },
  { header: 'bg-cyan-100/55 text-cyan-950', border: 'border-cyan-200', hue: 189 },
  { header: 'bg-teal-100/55 text-teal-950', border: 'border-teal-200', hue: 169 },
  { header: 'bg-emerald-100/55 text-emerald-950', border: 'border-emerald-200', hue: 148 },
  { header: 'bg-lime-100/55 text-lime-950', border: 'border-lime-200', hue: 96 },
  { header: 'bg-amber-100/55 text-amber-950', border: 'border-amber-200', hue: 42 },
  { header: 'bg-orange-100/55 text-orange-950', border: 'border-orange-200', hue: 28 },
  { header: 'bg-rose-100/55 text-rose-950', border: 'border-rose-200', hue: 352 },
  { header: 'bg-red-100/55 text-red-950', border: 'border-red-200', hue: 4 },
  { header: 'bg-pink-100/55 text-pink-950', border: 'border-pink-200', hue: 330 },
  { header: 'bg-fuchsia-100/55 text-fuchsia-950', border: 'border-fuchsia-200', hue: 300 },
  { header: 'bg-violet-100/55 text-violet-950', border: 'border-violet-200', hue: 266 },
  { header: 'bg-indigo-100/55 text-indigo-950', border: 'border-indigo-200', hue: 244 },
  { header: 'bg-blue-100/55 text-blue-950', border: 'border-blue-200', hue: 221 },
  { header: 'bg-zinc-100/55 text-zinc-900', border: 'border-zinc-300', hue: 220 },
  { header: 'bg-stone-100/55 text-stone-900', border: 'border-stone-300', hue: 32 },
  { header: 'bg-gray-100/55 text-gray-900', border: 'border-gray-300', hue: 210 },
];

export const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
};

export const getSiteTheme = (siteId: string) => {
  const theme = siteId ? SITE_COLOR_THEMES[hashString(siteId) % SITE_COLOR_THEMES.length] : SITE_COLOR_THEMES[0];
  const darkTone = buildDarkSiteTone(theme.hue);

  return {
    ...theme,
    header: `${theme.header} dark:[background-color:var(--site-dark-bg)] dark:[color:var(--site-dark-text)] dark:ring-1 dark:ring-inset dark:[ring-color:var(--site-dark-ring)]`,
    border: `${theme.border} dark:[border-color:var(--site-dark-ring)]`,
    styleVars: {
      '--site-dark-bg': darkTone.bg,
      '--site-dark-ring': darkTone.ring,
      '--site-dark-text': darkTone.text,
    } as Record<string, string>,
  };
};

export const formatDateFriendly = (dateStr: string) => {
  const date = parseISODateLocal(dateStr);
  if (!date) return dateStr;
  if (toLocalISODate(date) === toLocalISODate()) return "오늘";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};
