import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppState, Site, Worker, WorkLog, Transaction, ChecklistItem } from '@/types';

const EMPTY_STATE: AppState = { sites: [], workers: [], workLogs: [], transactions: [], checklists: [] };

async function fetchAll<T>(table: string, orderCol: string, ascending: boolean, limit: number = 100): Promise<T[]> {
  const db = supabase as any;
  let query = db
    .from(table)
    .select('*')
    .order(orderCol, { ascending });

  // work_logs와 transactions 테이블만 100개 제한
  if (['work_logs', 'transactions', 'checklists'].includes(table)) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }

  return data || [];
}

function mapSite(s: any): Site {
  return { id: s.id, name: s.name, budget: s.budget || 0, company_name: s.company_name || '', status: s.status || 'active' };
}
function mapWorker(w: any): Worker {
  return { id: w.id, name: w.name, daily: w.daily || 150000 };
}
function mapWorkLog(l: any): WorkLog {
  return { id: l.id, date: l.date, site_id: l.site_id, worker_id: l.worker_id, md: parseFloat(l.md) || 1, note: l.note || '' };
}
function mapTransaction(t: any): Transaction {
  return { id: t.id, date: t.date, site_id: t.site_id || '', worker_id: '', type: 'expense' as const, category: t.category, description: t.description || '', amount: t.amount || 0 };
}
function mapChecklist(c: any): ChecklistItem {
  return { id: c.id, type: c.type, date: c.date, title: c.title, amount: c.amount || 0, status: c.status || 'pending', memo: c.memo || '' };
}

type TableKey = 'sites' | 'workers' | 'workLogs' | 'transactions' | 'checklists';

const TABLE_CONFIG: Record<string, { key: TableKey; mapper: (r: any) => any }> = {
  sites: { key: 'sites', mapper: mapSite },
  workers: { key: 'workers', mapper: mapWorker },
  work_logs: { key: 'workLogs', mapper: mapWorkLog },
  transactions: { key: 'transactions', mapper: mapTransaction },
  checklists: { key: 'checklists', mapper: mapChecklist },
};

export const useSupabaseData = (addToast: (msg: string, type: 'success' | 'error' | 'info') => void) => {
  const [data, setDataLocal] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const pendingOps = useRef<Promise<void>[]>([]);
  const isSyncing = useRef(false);
  const isInitialLoad = useRef(false);
  const addToastRef = useRef(addToast);

  // Update ref when addToast changes to avoid stale closures
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  const loadAll = useCallback(async () => {
    if (isInitialLoad.current) return;
    setLoading(true);
    try {
      // Load recent data with optimized limits for faster initial loading
      const [sitesData, workersData, logsData, transData, checkData] = await Promise.all([
        fetchAll<any>('sites', 'created_at', true),
        fetchAll<any>('workers', 'created_at', true),
        fetchAll<any>('work_logs', 'date', false),
        fetchAll<any>('transactions', 'date', false),
        fetchAll<any>('checklists', 'date', false),
      ]);

      setDataLocal({
        sites: sitesData.map(mapSite),
        workers: workersData.map(mapWorker),
        workLogs: logsData.map(mapWorkLog),
        transactions: transData.map(mapTransaction),
        checklists: checkData.map(mapChecklist),
      });
      isInitialLoad.current = true;
    } catch (err) {
      console.error('Data load error:', err);
      addToastRef.current('데이터 로딩 실패. 새로고침 해주세요.', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // Remove addToast dependency to prevent infinite loop

  useEffect(() => { 
    loadAll(); 
  }, [loadAll]);

  // Realtime: apply individual record changes instead of full reload
  useEffect(() => {
    const handleChange = (tableName: string) => (payload: any) => {
      if (isSyncing.current) return;
      const config = TABLE_CONFIG[tableName];
      if (!config) return;

      const { key, mapper } = config;
      const { eventType, new: newRow, old: oldRow } = payload;

      setDataLocal(prev => {
        const list = [...(prev[key] as any[])];
        
        if (eventType === 'INSERT') {
          const mapped = mapper(newRow);
          if (!list.some((item: any) => item.id === mapped.id)) {
            list.push(mapped);
          }
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

        return { ...prev, [key]: list };
      });
    };

    const channel = (supabase as any)
      .channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, handleChange('sites'))
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
    setDataLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const op = syncChanges(prev, next);
      pendingOps.current.push(op);
      return next;
    });
  }, []);

  const syncChanges = async (prev: AppState, next: AppState) => {
    isSyncing.current = true;
    try {
      await Promise.all([
        syncTable('sites', prev.sites, next.sites, (s: Site) => ({
          id: s.id, name: s.name, budget: s.budget, company_name: s.company_name || null, status: s.status,
        })),
        syncTable('workers', prev.workers, next.workers, (w: Worker) => ({
          id: w.id, name: w.name, daily: w.daily,
        })),
        syncTable('work_logs', prev.workLogs, next.workLogs, (l: WorkLog) => ({
          id: l.id, date: l.date, site_id: l.site_id, worker_id: l.worker_id, md: l.md, note: l.note || null,
        })),
        syncTable('transactions', prev.transactions, next.transactions, (t: Transaction) => ({
          id: t.id, date: t.date, site_id: t.site_id || null, category: t.category, amount: t.amount, description: t.description || null,
        })),
        syncTable('checklists', prev.checklists, next.checklists, (c: ChecklistItem) => ({
          id: c.id, type: c.type, date: c.date, title: c.title, amount: c.amount, status: c.status, memo: c.memo || null,
        })),
      ]);
    } catch (err) {
      console.error('Sync error:', err);
      addToastRef.current('데이터 저장 실패. 다시 시도해주세요.', 'error');
    } finally {
      setTimeout(() => { isSyncing.current = false; }, 2000);
    }
  };

  return { data, setData, loading, reload: loadAll };
};

// Optimized deep comparison function to avoid JSON.stringify overhead
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

async function syncTable<T extends { id: string }>(
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Record<string, unknown>
) {
  const db = supabase as any;
  const prevIds = new Set(prev.map(i => i.id));
  const nextIds = new Set(next.map(i => i.id));
  const prevMap = new Map(prev.map(i => [i.id, i]));

  const toInsert = next.filter(i => !prevIds.has(i.id));
  const toUpdate = next.filter(i => {
    if (!prevIds.has(i.id)) return false;
    const prevItem = prevMap.get(i.id);
    return prevItem ? hasChanged(prevItem, i) : true;
  });
  const toUpsert = [...toInsert, ...toUpdate];
  
  if (toUpsert.length > 0) {
    const { error } = await db.from(table).upsert(toUpsert.map(toRow));
    if (error) throw error;
  }

  const toDelete = prev.filter(i => !nextIds.has(i.id));
  if (toDelete.length > 0) {
    const { error } = await db.from(table).delete().in('id', toDelete.map(i => i.id));
    if (error) throw error;
  }
}
