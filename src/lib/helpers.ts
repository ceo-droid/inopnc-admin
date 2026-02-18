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
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
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

export const SITE_COLOR_THEMES = [
  { header: 'bg-muted/65 text-foreground dark:bg-muted/62 dark:ring-1 dark:ring-inset dark:ring-white/10', border: 'border-border' },
  { header: 'bg-teal-50/55 text-teal-950 dark:bg-sky-500/24 dark:text-sky-50 dark:ring-1 dark:ring-inset dark:ring-sky-300/45', border: 'border-teal-200 dark:border-sky-700' },
  { header: 'bg-slate-100/55 text-slate-900 dark:bg-indigo-500/22 dark:text-indigo-50 dark:ring-1 dark:ring-inset dark:ring-indigo-300/45', border: 'border-slate-300 dark:border-indigo-700' },
  { header: 'bg-cyan-100/55 text-cyan-950 dark:bg-cyan-500/24 dark:text-cyan-50 dark:ring-1 dark:ring-inset dark:ring-cyan-300/45', border: 'border-cyan-200 dark:border-cyan-700' },
  { header: 'bg-emerald-50/50 text-emerald-950 dark:bg-emerald-500/22 dark:text-emerald-50 dark:ring-1 dark:ring-inset dark:ring-emerald-300/45', border: 'border-emerald-200 dark:border-emerald-700' },
  { header: 'bg-stone-100/55 text-stone-900 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-1 dark:ring-inset dark:ring-amber-300/40', border: 'border-stone-300 dark:border-amber-700' },
  { header: 'bg-zinc-100/55 text-zinc-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-50 dark:ring-1 dark:ring-inset dark:ring-fuchsia-300/40', border: 'border-zinc-300 dark:border-fuchsia-700' },
  { header: 'bg-teal-100/50 text-teal-950 dark:bg-violet-500/22 dark:text-violet-50 dark:ring-1 dark:ring-inset dark:ring-violet-300/45', border: 'border-teal-200 dark:border-violet-700' },
  { header: 'bg-gray-100/55 text-gray-900 dark:bg-rose-500/20 dark:text-rose-50 dark:ring-1 dark:ring-inset dark:ring-rose-300/40', border: 'border-gray-300 dark:border-rose-700' },
];

export const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
};

export const getSiteTheme = (siteId: string) => {
  if (!siteId) return SITE_COLOR_THEMES[0];
  return SITE_COLOR_THEMES[hashString(siteId) % SITE_COLOR_THEMES.length];
};

export const formatDateFriendly = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (d.getTime() === t.getTime()) return "오늘";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};
