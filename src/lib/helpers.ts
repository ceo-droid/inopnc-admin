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
  { header: 'bg-slate-100/55 text-slate-900 dark:bg-slate-500/26 dark:text-slate-50 dark:ring-1 dark:ring-inset dark:ring-slate-300/40', border: 'border-slate-300 dark:border-slate-700' },
  { header: 'bg-sky-100/55 text-sky-950 dark:bg-sky-500/28 dark:text-sky-50 dark:ring-1 dark:ring-inset dark:ring-sky-300/45', border: 'border-sky-200 dark:border-sky-700' },
  { header: 'bg-cyan-100/55 text-cyan-950 dark:bg-cyan-500/28 dark:text-cyan-50 dark:ring-1 dark:ring-inset dark:ring-cyan-300/45', border: 'border-cyan-200 dark:border-cyan-700' },
  { header: 'bg-teal-100/55 text-teal-950 dark:bg-teal-500/28 dark:text-teal-50 dark:ring-1 dark:ring-inset dark:ring-teal-300/45', border: 'border-teal-200 dark:border-teal-700' },
  { header: 'bg-emerald-100/55 text-emerald-950 dark:bg-emerald-500/28 dark:text-emerald-50 dark:ring-1 dark:ring-inset dark:ring-emerald-300/45', border: 'border-emerald-200 dark:border-emerald-700' },
  { header: 'bg-lime-100/55 text-lime-950 dark:bg-lime-500/26 dark:text-lime-50 dark:ring-1 dark:ring-inset dark:ring-lime-300/40', border: 'border-lime-200 dark:border-lime-700' },
  { header: 'bg-amber-100/55 text-amber-950 dark:bg-amber-500/26 dark:text-amber-50 dark:ring-1 dark:ring-inset dark:ring-amber-300/40', border: 'border-amber-200 dark:border-amber-700' },
  { header: 'bg-orange-100/55 text-orange-950 dark:bg-orange-500/26 dark:text-orange-50 dark:ring-1 dark:ring-inset dark:ring-orange-300/40', border: 'border-orange-200 dark:border-orange-700' },
  { header: 'bg-rose-100/55 text-rose-950 dark:bg-rose-500/26 dark:text-rose-50 dark:ring-1 dark:ring-inset dark:ring-rose-300/40', border: 'border-rose-200 dark:border-rose-700' },
  { header: 'bg-red-100/55 text-red-950 dark:bg-red-500/26 dark:text-red-50 dark:ring-1 dark:ring-inset dark:ring-red-300/40', border: 'border-red-200 dark:border-red-700' },
  { header: 'bg-pink-100/55 text-pink-950 dark:bg-pink-500/26 dark:text-pink-50 dark:ring-1 dark:ring-inset dark:ring-pink-300/40', border: 'border-pink-200 dark:border-pink-700' },
  { header: 'bg-fuchsia-100/55 text-fuchsia-950 dark:bg-fuchsia-500/26 dark:text-fuchsia-50 dark:ring-1 dark:ring-inset dark:ring-fuchsia-300/40', border: 'border-fuchsia-200 dark:border-fuchsia-700' },
  { header: 'bg-violet-100/55 text-violet-950 dark:bg-violet-500/26 dark:text-violet-50 dark:ring-1 dark:ring-inset dark:ring-violet-300/40', border: 'border-violet-200 dark:border-violet-700' },
  { header: 'bg-indigo-100/55 text-indigo-950 dark:bg-indigo-500/26 dark:text-indigo-50 dark:ring-1 dark:ring-inset dark:ring-indigo-300/40', border: 'border-indigo-200 dark:border-indigo-700' },
  { header: 'bg-blue-100/55 text-blue-950 dark:bg-blue-500/26 dark:text-blue-50 dark:ring-1 dark:ring-inset dark:ring-blue-300/40', border: 'border-blue-200 dark:border-blue-700' },
  { header: 'bg-zinc-100/55 text-zinc-900 dark:bg-zinc-500/24 dark:text-zinc-50 dark:ring-1 dark:ring-inset dark:ring-zinc-300/35', border: 'border-zinc-300 dark:border-zinc-700' },
  { header: 'bg-stone-100/55 text-stone-900 dark:bg-stone-500/24 dark:text-stone-50 dark:ring-1 dark:ring-inset dark:ring-stone-300/35', border: 'border-stone-300 dark:border-stone-700' },
  { header: 'bg-gray-100/55 text-gray-900 dark:bg-gray-500/24 dark:text-gray-50 dark:ring-1 dark:ring-inset dark:ring-gray-300/35', border: 'border-gray-300 dark:border-gray-700' },
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
