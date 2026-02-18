import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppState, Site, Worker, WorkLog, Transaction, ChecklistItem, Customer } from '@/types';

const EMPTY_STATE: AppState = { sites: [], customers: [], workers: [], workLogs: [], transactions: [], checklists: [] };
const PAGED_TABLES = new Set(['work_logs', 'transactions', 'checklists']);
const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 4;
const CACHE_KEY = 'inopnc_app_state_cache_v2';
const CACHE_TS_KEY = 'inopnc_app_state_cache_ts_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

const TABLE_SELECTS: Record<string, string> = {
  sites: 'id,name,budget,company_name,status,created_at',
  customers: 'id,name,contact,created_at',
  workers: 'id,name,daily,created_at',
  work_logs: 'id,date,site_id,worker_id,md,note,created_at',
  transactions: 'id,date,site_id,category,description,amount,created_at',
  checklists:
    'id,type,date,title,amount,status,memo,supplier,quantity,unit_price,shipping_type,payment_status,created_at',
};

const isBrowser = () => typeof window !== 'undefined';

function readCache(): AppState | null {
  if (!isBrowser()) return null;
  try {
    const ts = Number(localStorage.getItem(CACHE_TS_KEY) || 0);
    if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;

    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || !Array.isArray(parsed.sites) || !Array.isArray(parsed.workers)) return null;
    return {
      ...EMPTY_STATE,
      ...parsed,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    };
  } catch {
    return null;
  }
}

function writeCache(state: AppState) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    // Ignore quota/cache write errors
  }
}

async function fetchSinglePage<T>(
  table: string,
  orderCol: string,
  ascending: boolean,
  from: number,
  to: number
): Promise<T[]> {
  const selectCols = TABLE_SELECTS[table] || '*';
  const db = supabase as any;
  const { data, error } = await db
    .from(table)
    .select(selectCols)
    .order(orderCol, { ascending })
    .range(from, to);

  if (error) {
    console.error(`Error fetching ${table} [${from}-${to}]:`, error);
    return [];
  }
  return data || [];
}

async function fetchAll<T>(table: string, orderCol: string, ascending: boolean): Promise<T[]> {
  const db = supabase as any;
  const selectCols = TABLE_SELECTS[table] || '*';

  if (!PAGED_TABLES.has(table)) {
    const { data, error } = await db
      .from(table)
      .select(selectCols)
      .order(orderCol, { ascending });

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return [];
    }
    return data || [];
  }

  const { count, error: countError } = await db
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.error(`Error counting ${table}:`, countError);
    return [];
  }

  if (!count || count <= 0) return [];

  const pageRanges: Array<{ from: number; to: number }> = [];
  for (let from = 0; from < count; from += PAGE_SIZE) {
    pageRanges.push({ from, to: Math.min(from + PAGE_SIZE - 1, count - 1) });
  }

  const pages: T[][] = new Array(pageRanges.length);
  for (let i = 0; i < pageRanges.length; i += PAGE_CONCURRENCY) {
    const chunk = pageRanges.slice(i, i + PAGE_CONCURRENCY);
    const chunkData = await Promise.all(
      chunk.map((range) => fetchSinglePage<T>(table, orderCol, ascending, range.from, range.to))
    );
    chunkData.forEach((rows, idx) => {
      pages[i + idx] = rows;
    });
  }

  return pages.flat();
}

function mapSite(s: any): Site {
  const rawStatus = String(s.status || '').toLowerCase();
  const status =
    rawStatus === 'planned' || rawStatus === 'scheduled' || rawStatus === '예정'
      ? 'scheduled'
      : rawStatus === 'completed' || rawStatus === '완료' || rawStatus === 'done'
      ? 'completed'
      : 'active';

  return {
    id: s.id,
    name: s.name,
    budget: s.budget || 0,
    company_name: s.company_name || '',
    status,
  };
}

function mapWorker(w: any): Worker {
  return { id: w.id, name: w.name, daily: w.daily || 150000 };
}

function mapCustomer(c: any): Customer {
  return {
    id: c.id,
    name: c.name,
    contact: c.contact || '',
  };
}

function mapWorkLog(l: any): WorkLog {
  return {
    id: l.id,
    date: l.date,
    site_id: l.site_id,
    worker_id: l.worker_id,
    md: parseFloat(l.md) || 1,
    note: l.note || '',
  };
}

function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    date: t.date,
    site_id: t.site_id || '',
    worker_id: '',
    type: 'expense' as const,
    category: t.category,
    description: t.description || '',
    amount: t.amount || 0,
  };
}

function mapChecklist(c: any): ChecklistItem {
  return {
    id: c.id,
    type: c.type,
    date: c.date,
    title: c.title,
    amount: c.amount || 0,
    status: c.status || 'pending',
    memo: c.memo || '',
    supplier: c.supplier || '',
    quantity: c.quantity == null ? undefined : Number(c.quantity) || 0,
    unitPrice: c.unit_price == null ? undefined : Number(c.unit_price) || 0,
    shippingType: c.shipping_type || undefined,
    paymentStatus: c.payment_status || undefined,
  };
}

type TableKey = 'sites' | 'customers' | 'workers' | 'workLogs' | 'transactions' | 'checklists';

const TABLE_CONFIG: Record<string, { key: TableKey; mapper: (r: any) => any }> = {
  sites: { key: 'sites', mapper: mapSite },
  customers: { key: 'customers', mapper: mapCustomer },
  workers: { key: 'workers', mapper: mapWorker },
  work_logs: { key: 'workLogs', mapper: mapWorkLog },
  transactions: { key: 'transactions', mapper: mapTransaction },
  checklists: { key: 'checklists', mapper: mapChecklist },
};

export const useSupabaseData = (addToast: (msg: string, type: 'success' | 'error' | 'info') => void) => {
  const [data, setDataLocal] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const isSyncing = useRef(false);
  const isInitialLoad = useRef(false);
  const addToastRef = useRef(addToast);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  const loadAll = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = !!opts?.force;
    const silent = !!opts?.silent;

    if (isInitialLoad.current && !force) return;
    if (!silent) setLoading(true);

    try {
      const [sitesData, customersData, workersData, logsData, transData, checkData] = await Promise.all([
        fetchAll<any>('sites', 'created_at', true),
        fetchAll<any>('customers', 'created_at', true),
        fetchAll<any>('workers', 'created_at', true),
        fetchAll<any>('work_logs', 'date', false),
        fetchAll<any>('transactions', 'date', false),
        fetchAll<any>('checklists', 'date', false),
      ]);

      const nextState: AppState = {
        sites: sitesData.map(mapSite),
        customers: customersData.map(mapCustomer),
        workers: workersData.map(mapWorker),
        workLogs: logsData.map(mapWorkLog),
        transactions: transData.map(mapTransaction),
        checklists: checkData.map(mapChecklist),
      };

      setDataLocal(nextState);
      writeCache(nextState);
      isInitialLoad.current = true;
    } catch (err) {
      console.error('Data load error:', err);
      addToastRef.current('데이터 로딩 실패. 새로고침 해주세요.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setDataLocal(cached);
      setLoading(false);
      loadAll({ force: true, silent: true });
    } else {
      loadAll();
    }
  }, [loadAll]);

  useEffect(() => {
    const handleChange = (tableName: string) => (payload: any) => {
      if (isSyncing.current) return;
      const config = TABLE_CONFIG[tableName];
      if (!config) return;

      const { key, mapper } = config;
      const { eventType, new: newRow, old: oldRow } = payload;

      setDataLocal((prev) => {
        const list = [...(prev[key] as any[])];

        if (eventType === 'INSERT') {
          const mapped = mapper(newRow);
          if (!list.some((item: any) => item.id === mapped.id)) list.push(mapped);
        } else if (eventType === 'UPDATE') {
          const mapped = mapper(newRow);
          const idx = list.findIndex((item: any) => item.id === mapped.id);
          if (idx >= 0) list[idx] = mapped;
          else list.push(mapped);
        } else if (eventType === 'DELETE') {
          const delId = oldRow?.id;
          if (delId) {
            const idx = list.findIndex((item: any) => item.id === delId);
            if (idx >= 0) list.splice(idx, 1);
          }
        }

        const next = { ...prev, [key]: list };
        writeCache(next);
        return next;
      });
    };

    const channel = (supabase as any)
      .channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, handleChange('sites'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, handleChange('customers'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, handleChange('workers'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs' }, handleChange('work_logs'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handleChange('transactions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, handleChange('checklists'))
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  const setData: React.Dispatch<React.SetStateAction<AppState>> = useCallback((updater) => {
    setDataLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeCache(next);
      void syncChanges(prev, next, addToastRef, isSyncing);
      return next;
    });
  }, []);

  return { data, setData, loading, reload: () => loadAll({ force: true }) };
};

function hasChanged<T>(prev: T, next: T): boolean {
  if (prev === next) return false;
  if (typeof prev !== 'object' || typeof next !== 'object') return prev !== next;
  if (prev === null || next === null) return prev !== next;

  const prevKeys = Object.keys(prev as any);
  const nextKeys = Object.keys(next as any);
  if (prevKeys.length !== nextKeys.length) return true;

  for (const key of prevKeys) {
    if (!nextKeys.includes(key)) return true;
    if ((prev as any)[key] !== (next as any)[key]) return true;
  }
  return false;
}

async function syncChanges(
  prev: AppState,
  next: AppState,
  addToastRef: MutableRefObject<(msg: string, type: 'success' | 'error' | 'info') => void>,
  isSyncing: MutableRefObject<boolean>
) {
  isSyncing.current = true;
  try {
    const tasks: Promise<void>[] = [];

    if (prev.sites !== next.sites) {
      tasks.push(
        syncTable('sites', prev.sites, next.sites, (s: Site) => ({
          id: s.id, name: s.name, budget: s.budget, company_name: s.company_name || null, status: s.status,
        }))
      );
    }

    if (prev.customers !== next.customers) {
      tasks.push(
        syncTable('customers', prev.customers, next.customers, (c: Customer) => ({
          id: c.id,
          name: c.name,
          contact: c.contact || null,
        }))
      );
    }

    if (prev.workers !== next.workers) {
      tasks.push(
        syncTable('workers', prev.workers, next.workers, (w: Worker) => ({
          id: w.id, name: w.name, daily: w.daily,
        }))
      );
    }

    if (prev.workLogs !== next.workLogs) {
      tasks.push(
        syncTable('work_logs', prev.workLogs, next.workLogs, (l: WorkLog) => ({
          id: l.id, date: l.date, site_id: l.site_id, worker_id: l.worker_id, md: l.md, note: l.note || null,
        }))
      );
    }

    if (prev.transactions !== next.transactions) {
      tasks.push(
        syncTable('transactions', prev.transactions, next.transactions, (t: Transaction) => ({
          id: t.id, date: t.date, site_id: t.site_id || null, category: t.category, amount: t.amount, description: t.description || null,
        }))
      );
    }

    if (prev.checklists !== next.checklists) {
      tasks.push(
        syncTable('checklists', prev.checklists, next.checklists, (c: ChecklistItem) => ({
          id: c.id,
          type: c.type,
          date: c.date,
          title: c.title,
          amount: c.amount,
          status: c.status,
          memo: c.memo || null,
          supplier: c.supplier || null,
          quantity: c.quantity ?? null,
          unit_price: c.unitPrice ?? null,
          shipping_type: c.shippingType || null,
          payment_status: c.paymentStatus || null,
        }))
      );
    }

    await Promise.all(tasks);
  } catch (err) {
    console.error('Sync error:', err);
    addToastRef.current('데이터 저장 실패. 다시 시도해주세요.', 'error');
  } finally {
    setTimeout(() => {
      isSyncing.current = false;
    }, 800);
  }
}

async function syncTable<T extends { id: string }>(
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Record<string, unknown>
) {
  const db = supabase as any;
  const prevIds = new Set(prev.map((i) => i.id));
  const nextIds = new Set(next.map((i) => i.id));
  const prevMap = new Map(prev.map((i) => [i.id, i]));

  const toInsert = next.filter((i) => !prevIds.has(i.id));
  const toUpdate = next.filter((i) => {
    if (!prevIds.has(i.id)) return false;
    const prevItem = prevMap.get(i.id);
    return prevItem ? hasChanged(prevItem, i) : true;
  });
  const toUpsert = [...toInsert, ...toUpdate];

  if (toUpsert.length > 0) {
    const { error } = await db.from(table).upsert(toUpsert.map(toRow));
    if (error) throw error;
  }

  const toDelete = prev.filter((i) => !nextIds.has(i.id));
  if (toDelete.length > 0) {
    const { error } = await db.from(table).delete().in('id', toDelete.map((i) => i.id));
    if (error) throw error;
  }
}
