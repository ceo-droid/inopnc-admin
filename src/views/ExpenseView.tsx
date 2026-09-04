import React, { useState, useRef, useMemo } from 'react';
import { Wallet, Search, Plus, FileSpreadsheet, Download, Trash2, ChevronDown, Edit2, Pen, X } from 'lucide-react';
import type { AppState, Transaction, ExpenseCategory, WorkLog } from '@/types';
import { formatCurrency, calcPayroll, normalizeText, toLocalISODate } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';
import SearchableSelect from '@/components/app/SearchableSelect';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { decodeCSVBuffer, toISODate, parseAmount } from '@/lib/csvUtils';
import { findBestMatch } from '@/lib/siteNameMatcher';
import { EXPENSE_CATEGORIES, isExpenseCategory } from '@/constants/expenseCategories';
import { isActiveExpense } from '@/lib/expenseIntegrity';
import type { ExpenseCommandBoundary } from '@/services/expenseCommands';

interface ExpenseViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  expenseCommands: ExpenseCommandBoundary;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const ExpenseView = ({ data, setData, expenseCommands, addToast, recentSiteIds, recentWorkerIds }: ExpenseViewProps) => {
  type ProfitDetailMode = 'labor' | 'expense';
  const [expSiteId, setExpSiteId] = useState('');
  const [expWorkerId, setExpWorkerId] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory | ''>('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => toLocalISODate());
  const [profitSearch, setProfitSearch] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [profitDetail, setProfitDetail] = useState<{ siteId: string; mode: ProfitDetailMode } | null>(null);
  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingLaborDraft, setEditingLaborDraft] = useState<{ date: string; worker_id: string; md: string; note: string }>({
    date: '',
    worker_id: '',
    md: '1',
    note: '',
  });
  const [editingExpenseDraft, setEditingExpenseDraft] = useState<{ date: string; category: string; description: string; amount: string }>({
    date: '',
    category: '',
    description: '',
    amount: '0',
  });

  const categories: readonly ExpenseCategory[] = EXPENSE_CATEGORIES;
  const excelInputRef = useRef<HTMLInputElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const activeTransactions = useMemo(() => data.transactions.filter(isActiveExpense), [data.transactions]);
  const sortedTransactions = [...activeTransactions].sort((a, b) => b.date.localeCompare(a.date));

  const workersById = useMemo(() => Object.fromEntries(data.workers.map(w => [w.id, w] as const)), [data.workers]);
  const sitesById = useMemo(() => new Map(data.sites.map(s => [s.id, s] as const)), [data.sites]);
  const siteIdByNormalizedName = useMemo(() => {
    const map = new Map<string, string>();
    data.sites.forEach((site) => {
      const key = normalizeText(site.name).toLowerCase();
      if (key && !map.has(key)) map.set(key, site.id);
    });
    return map;
  }, [data.sites]);

  const resolveSiteId = useMemo(() => {
    const cache = new Map<string, string>();
    return (rawValue: string | undefined | null): string => {
      const raw = String(rawValue ?? '').trim();
      if (!raw) return '';

      if (sitesById.has(raw)) return raw;

      const key = normalizeText(raw).toLowerCase();
      if (!key) return '';

      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const byName = siteIdByNormalizedName.get(key);
      if (byName) {
        cache.set(key, byName);
        return byName;
      }

      const match = findBestMatch(raw, data.sites);
      const resolved = match?.siteId || '';
      cache.set(key, resolved);
      return resolved;
    };
  }, [data.sites, sitesById, siteIdByNormalizedName]);

  const siteStats = useMemo(() => {
    const laborBySite = new Map<string, { gross: number; tax: number; net: number }>();
    const expenseBySite = new Map<string, number>();

    data.workLogs.forEach((log) => {
      const siteId = resolveSiteId(log.site_id);
      if (!siteId) return;

      const daily = workersById[log.worker_id]?.daily || 0;
      const { gross, tax, net } = calcPayroll(daily, log.md);
      const prev = laborBySite.get(siteId) || { gross: 0, tax: 0, net: 0 };
      laborBySite.set(siteId, {
        gross: prev.gross + gross,
        tax: prev.tax + tax,
        net: prev.net + net,
      });
    });

    activeTransactions.forEach((t) => {
      const siteId = sitesById.has(t.site_id) ? t.site_id : '';
      if (!siteId) return;
      expenseBySite.set(siteId, (expenseBySite.get(siteId) || 0) + (Number(t.amount) || 0));
    });

    return data.sites.map(site => {
      const laborAgg = laborBySite.get(site.id) || { gross: 0, tax: 0, net: 0 };
      const expenseCost = expenseBySite.get(site.id) || 0;
      const totalCost = laborAgg.gross + expenseCost;
      const profit = site.budget - totalCost;
      return { ...site, laborCost: laborAgg.gross, laborTax: laborAgg.tax, laborNet: laborAgg.net, expenseCost, totalCost, profit };
    });
  }, [data.sites, data.workLogs, activeTransactions, workersById, resolveSiteId, sitesById]);

  const filteredStats = useMemo(() => {
    if (!profitSearch) return siteStats;
    return siteStats.filter(s => s.id === profitSearch);
  }, [siteStats, profitSearch]);

  const laborDetailsBySite = useMemo(() => {
    const map = new Map<string, Array<{
      id: string;
      date: string;
      workerId: string;
      workerName: string;
      md: number;
      daily: number;
      gross: number;
      tax: number;
      net: number;
      note: string;
    }>>();

    data.workLogs.forEach((log) => {
      const siteId = resolveSiteId(log.site_id);
      if (!siteId) return;

      const worker = workersById[log.worker_id];
      const daily = worker?.daily || 0;
      const { gross, tax, net } = calcPayroll(daily, log.md);
      const row = {
        id: log.id,
        date: log.date,
        workerId: log.worker_id,
        workerName: worker?.name || '-',
        md: log.md,
        daily,
        gross,
        tax,
        net,
        note: log.note || '',
      };

      if (!map.has(siteId)) map.set(siteId, []);
      map.get(siteId)!.push(row);
    });

    map.forEach((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
    return map;
  }, [data.workLogs, workersById, resolveSiteId]);

  const expenseDetailsBySite = useMemo(() => {
    const map = new Map<string, Array<{
      id: string;
      date: string;
      category: string;
      description: string;
      amount: number;
      workerName: string;
    }>>();

    activeTransactions.forEach((t) => {
      const siteId = sitesById.has(t.site_id) ? t.site_id : '';
      if (!siteId) return;

      const workerName = t.worker_id ? (workersById[t.worker_id]?.name || '') : '';
      const row = {
        id: t.id,
        date: t.date,
        category: String(t.category || ''),
        description: String(t.description || ''),
        amount: Number(t.amount) || 0,
        workerName,
      };

      if (!map.has(siteId)) map.set(siteId, []);
      map.get(siteId)!.push(row);
    });

    map.forEach((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
    return map;
  }, [activeTransactions, sitesById, workersById]);

  const selectedDetailSite = useMemo(
    () => (profitDetail ? (sitesById.get(profitDetail.siteId) || null) : null),
    [profitDetail, sitesById]
  );
  const selectedLaborDetails = useMemo(
    () => (profitDetail ? (laborDetailsBySite.get(profitDetail.siteId) || []) : []),
    [profitDetail, laborDetailsBySite]
  );
  const selectedExpenseDetails = useMemo(
    () => (profitDetail ? (expenseDetailsBySite.get(profitDetail.siteId) || []) : []),
    [profitDetail, expenseDetailsBySite]
  );
  const selectedLaborTotals = useMemo(
    () =>
      selectedLaborDetails.reduce(
        (acc, row) => ({
          gross: acc.gross + row.gross,
          tax: acc.tax + row.tax,
          net: acc.net + row.net,
          md: acc.md + row.md,
        }),
        { gross: 0, tax: 0, net: 0, md: 0 }
      ),
    [selectedLaborDetails]
  );
  const selectedExpenseTotal = useMemo(
    () => selectedExpenseDetails.reduce((sum, row) => sum + row.amount, 0),
    [selectedExpenseDetails]
  );

  const closeProfitDetail = () => {
    setProfitDetail(null);
    setEditingLaborId(null);
    setEditingExpenseId(null);
  };

  const preserveDetailScroll = (updater: () => void) => {
    const top = detailScrollRef.current?.scrollTop ?? 0;
    updater();
    requestAnimationFrame(() => {
      if (detailScrollRef.current) detailScrollRef.current.scrollTop = top;
    });
  };

  const startLaborEdit = (rowId: string) => {
    const log = data.workLogs.find((l) => l.id === rowId);
    if (!log) return;
    setEditingExpenseId(null);
    setEditingLaborId(rowId);
    setEditingLaborDraft({
      date: log.date,
      worker_id: log.worker_id,
      md: String(log.md),
      note: log.note || '',
    });
  };

  const saveLaborEdit = () => {
    if (!profitDetail || !editingLaborId) return;

    const date = normalizeText(editingLaborDraft.date);
    const workerId = normalizeText(editingLaborDraft.worker_id);
    const md = Number(editingLaborDraft.md);
    const note = editingLaborDraft.note || '';

    if (!date) {
      addToast('날짜를 입력해주세요.', 'error');
      return;
    }
    if (!workerId) {
      addToast('작업자를 선택해주세요.', 'error');
      return;
    }
    if (!Number.isFinite(md) || md < 0) {
      addToast('공수 값을 확인해주세요.', 'error');
      return;
    }

    const duplicate = data.workLogs.some((l) => {
      if (l.id === editingLaborId) return false;
      const siteId = resolveSiteId(l.site_id);
      return siteId === profitDetail.siteId && l.date === date && l.worker_id === workerId && Number(l.md) === md;
    });

    if (duplicate) {
      addToast('동일 노무비 내역이 이미 존재합니다.', 'error');
      return;
    }

    setData((prev) => ({
      ...prev,
      workLogs: prev.workLogs.map((l: WorkLog) =>
        l.id === editingLaborId
          ? { ...l, date, worker_id: workerId, site_id: profitDetail.siteId, md, note }
          : l
      ),
    }));

    setEditingLaborId(null);
    addToast('노무비 내역을 저장했습니다.', 'success');
  };

  const startExpenseEdit = (rowId: string) => {
    const tx = data.transactions.find((t) => t.id === rowId);
    if (!tx) return;
    setEditingLaborId(null);
    setEditingExpenseId(rowId);
    setEditingExpenseDraft({
      date: tx.date,
      category: String(tx.category || ''),
      description: String(tx.description || ''),
      amount: String(tx.amount ?? 0),
    });
  };

  const saveExpenseEdit = async () => {
    if (!profitDetail || !editingExpenseId) return;

    const date = normalizeText(editingExpenseDraft.date);
    const category = normalizeText(editingExpenseDraft.category);
    const description = editingExpenseDraft.description || '';
    const amount = parseInt(String(editingExpenseDraft.amount || '').replace(/,/g, ''), 10);

    if (!date) {
      addToast('날짜를 입력해주세요.', 'error');
      return;
    }
    if (!category) {
      addToast('항목을 입력해주세요.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('금액을 확인해주세요.', 'error');
      return;
    }

    try {
      await expenseCommands.correctExpense(editingExpenseId, { date, category: category as ExpenseCategory, description, amount });
      await expenseCommands.updateExpenseAssignment(editingExpenseId, profitDetail.siteId);
      setEditingExpenseId(null);
    } catch (error) { addToast(String(error instanceof Error ? error.message : error), 'error'); }
  };

  const handleAddTransaction = async () => {
    if (!expCategory || !expAmount) return alert('항목(카테고리)과 금액을 입력해주세요.');
    const amount = parseInt(expAmount.replace(/,/g, ''), 10);
    const description = expDesc || expCategory;
    const newItem: Transaction = {
      id: crypto.randomUUID(), date: expDate, site_id: expSiteId, worker_id: expWorkerId,
      type: 'expense', category: expCategory, description,
      amount,
    };
    try {
      await expenseCommands.createExpense(newItem);
      setExpDesc(''); setExpAmount(''); setExpCategory('');
      addToast('지출 내역이 등록되었습니다.', 'success');
    } catch (error) { addToast(`등록 실패: ${String(error instanceof Error ? error.message : error)}`, 'error'); }
  };

  const processRows = (jsonData: Record<string, unknown>[]) => {
    if (!jsonData || jsonData.length === 0) { addToast('등록할 내역이 없거나 형식이 올바르지 않습니다.', 'error'); return; }

    const norm = (v: unknown) => String(v ?? '').trim();


    const sitesByName = new Map(data.sites.map(s => [s.name, s]));
    const workersByName = new Map(data.workers.map(w => [w.name, w]));
    const newTransactions: Transaction[] = [];

    for (const row of jsonData) {
      const siteName = norm(row['현장'] ?? row['현장_표준화'] ?? row['예산현장명'] ?? row['현장명'] ?? row['site'] ?? '');
      const workerName = norm(row['작업자'] ?? row['작업자(수동입력)'] ?? row['사용자(자동입력)'] ?? row['worker'] ?? '');
      const category = norm(row['항목'] ?? row['카테고리'] ?? row['category'] ?? '기타');
      const desc = norm(row['내용'] ?? row['설명'] ?? row['description'] ?? row['이용하신 가맹점명'] ?? row['이용하신 가맹점'] ?? category);
      const amount = parseAmount(row['금액'] ?? row['이용금액'] ?? row['amount'] ?? 0);
      const dateStr = toISODate(row['날짜'] ?? row['일자'] ?? row['date'] ?? '', XLSX);
      if (amount <= 0) continue;

      let siteId = '';
      if (siteName) {
        const found = sitesByName.get(siteName);
        if (found) { siteId = found.id; }
        else {
          siteId = '';
        }
      }

      let workerId = '';
      if (workerName) {
        const found = workersByName.get(workerName);
        if (found) workerId = found.id;
      }

      newTransactions.push({
        id: crypto.randomUUID(),
        date: dateStr, site_id: siteId, worker_id: workerId,
        type: 'expense', category: isExpenseCategory(category) ? category : '기타', description: desc, amount,
        source_namespace: 'expense-file-preview', source_row_key: String(newTransactions.length + 1),
      });
    }
    const reviewRequired = newTransactions.filter((row) => !row.site_id).length;
    addToast(`${newTransactions.length}건 파싱 완료 (${reviewRequired}건 현장 검토 필요). source identity 스키마 적용 전에는 등록하지 않습니다.`, 'info');
  };

  const handleExpenseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const buf = await file.arrayBuffer();
      const text = decodeCSVBuffer(buf);


      try {
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        processRows(parsed.data as Record<string, unknown>[]);
      } catch (err) {
        console.error(err);
        addToast('CSV 파싱 중 오류가 발생했습니다.', 'error');
      } finally {
        if (excelInputRef.current) excelInputRef.current.value = '';
      }
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataArr = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
          processRows(jsonData);
        } catch (err) {
          console.error(err);
          addToast('엑셀 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
          if (excelInputRef.current) excelInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (confirm('삭제하시겠습니까?')) {
      try { await expenseCommands.voidExpense(id); }
      catch (error) { addToast(String(error instanceof Error ? error.message : error), 'error'); }
    }
  };

  const handleSaveEditTx = async () => {
    if (!editingTx) return;
    try {
      await expenseCommands.correctExpense(editingTx.id, editingTx);
      await expenseCommands.updateExpenseAssignment(editingTx.id, editingTx.site_id);
      setEditingTx(null);
    } catch (error) { addToast(String(error instanceof Error ? error.message : error), 'error'); }
  };

  const downloadExpenseTemplate = () => {
    const sampleData = [
      { '날짜': '2026-01-15', '현장': '광주첨단센트럴', '작업자': '홍길동', '항목': '점심', '내용': '식당 이름', '금액': 35000 },
      { '날짜': '2026-01-15', '현장': '', '작업자': '', '항목': '주유', '내용': '주유소명', '금액': 80000 },
      { '날짜': '2026-01-16', '현장': '서대구힐스테이트', '작업자': '김철수', '항목': '자재', '내용': '자재 품목', '금액': 150000 },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // 날짜
      { wch: 20 }, // 현장
      { wch: 10 }, // 작업자
      { wch: 10 }, // 항목
      { wch: 20 }, // 내용
      { wch: 12 }, // 금액
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '경비지출');
    XLSX.writeFile(wb, '경비지출_업로드양식.xlsx');
    addToast('엑셀 양식이 다운로드되었습니다.', 'success');
  };

  const downloadProfitReport = () => {
    const excelData = siteStats.map(stat => ({
      '거래처': stat.company_name || '-', '현장명': stat.name, '예산': stat.budget,
      '노무비(총급여)': -stat.laborCost, '세금(3.3%)': -stat.laborTax, '실지급액': -stat.laborNet,
      '경비(지출)': -stat.expenseCost, '순수익': stat.profit,
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '수익보고서');
    XLSX.writeFile(wb, `현장별_수익보고서_${toLocalISODate()}.xlsx`);
    addToast('수익보고서 다운로드가 완료되었습니다.', 'success');
  };

  return (
    <div className="pb-24 animate-fade-in max-w-4xl mx-auto handset-landscape-view">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-extrabold text-[22px] text-foreground flex items-center gap-2"> 수익현황</h3>
        <button onClick={downloadProfitReport} className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-neon active:scale-95">
          <Download size={14} /> 수익보고서 엑셀저장
        </button>
      </div>

      {/* Profit Analysis */}
      <div className="mb-8">
        <div className="relative mb-4 w-full">
          <SearchableSelect
            value={profitSearch}
            onChange={setProfitSearch}
            options={[
              { id: '', label: '전체 현장' },
              ...data.sites.map(site => ({
                id: site.id,
                label: site.name
              }))
            ]}
            placeholder="현장명으로 수익 현황 검색..."
            recentIds={recentSiteIds}
          />
        </div>

        <div className="overflow-x-auto pb-2 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-3 snap-x snap-mandatory">
            {filteredStats.length === 0 && <div className="p-8 text-center text-muted-foreground w-full bg-card rounded-3xl border border-border">검색된 현장이 없습니다.</div>}
            {filteredStats.map(stat => (
              <div key={stat.id} className="bg-card rounded-2xl p-4 shadow-soft border border-border min-w-[260px] max-w-[300px] flex-shrink-0 flex flex-col justify-between snap-start transition-transform hover:scale-[1.02] duration-200">
                <div>
                  <div className="mb-2">
                    <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-1">{stat.name}</h3>
                    <span className="text-sm text-muted-foreground font-bold">예산 {formatCurrency(stat.budget)}</span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExpenseId(null);
                        setEditingLaborId(null);
                        setProfitDetail({ siteId: stat.id, mode: 'labor' });
                      }}
                      className="w-full flex justify-between text-xs items-center p-2 bg-orange-50 dark:bg-orange-900/10 rounded-xl hover:ring-1 hover:ring-orange-200 dark:hover:ring-orange-800 transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <span className="text-orange-600 font-bold leading-tight">노무비</span>
                        <span className="text-micro-md text-muted-foreground mt-0.5">세금 -{formatCurrency(stat.laborTax)} · 실지급 -{formatCurrency(stat.laborNet)}</span>
                      </div>
                      <span className="font-bold text-orange-500 whitespace-nowrap ml-2">-{formatCurrency(stat.laborCost)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExpenseId(null);
                        setEditingLaborId(null);
                        setProfitDetail({ siteId: stat.id, mode: 'expense' });
                      }}
                      className="w-full flex justify-between text-xs items-center p-2 bg-teal-50 dark:bg-teal-900/10 rounded-xl hover:ring-1 hover:ring-teal-200 dark:hover:ring-teal-800 transition-colors text-left"
                    >
                      <span className="text-teal-500 font-bold">경비</span>
                      <span className="font-bold text-teal-600">-{formatCurrency(stat.expenseCost)}</span>
                    </button>
                    <div className="h-px bg-border"></div>
                    <div className="flex justify-between text-sm px-1">
                      <span className="font-bold text-foreground">순수익</span>
                      <span className={`font-black ${stat.profit >= 0 ? 'text-foreground' : 'text-orange-500'}`}>{formatCurrency(stat.profit)}원</span>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${stat.profit >= 0 ? 'bg-primary' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.abs((stat.profit / (stat.budget || 1)) * 100), 100)}%` }}></div>
                </div>
                <div className="mt-1 text-micro-md text-muted-foreground text-right">
                  {stat.budget > 0 ? (
                    <span className={stat.profit >= 0 ? 'text-primary' : 'text-red-500'}>
                      수익률 {((stat.profit / stat.budget) * 100).toFixed(1)}%
                    </span>
                  ) : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="font-extrabold text-[22px] text-foreground mb-4 flex items-center gap-2"> 경비 지출 입력</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 handset-landscape-form-grid">
        <AppCard className="md:col-span-1 h-fit">
          <div className="space-y-4">
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">날짜</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none" />
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">현장 (수익 계산에 반영됨)</label>
              <SearchableSelect options={[{ id: '', label: '공통경비 (현장 미지정)' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={expSiteId} onChange={setExpSiteId} placeholder="현장 선택" recentIds={recentSiteIds} />
            </div>
            <div className="flex gap-2">
              <div className="flex-[1.2]">
                <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">작업자 (선택)</label>
                <SearchableSelect options={[{ id: '', label: '선택 안함' }, ...data.workers.map(w => ({ id: w.id, label: w.name }))]} value={expWorkerId} onChange={setExpWorkerId} placeholder="이름" recentIds={recentWorkerIds} />
              </div>
              <div className="flex-1">
                <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">항목</label>
                <div className="relative">
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-body font-semibold text-foreground outline-none appearance-none pr-6">
                    <option value="">선택</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">상세 내용 (선택)</label>
              <input
                type="text"
                placeholder="식당명, 품목 등"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-muted border border-border text-body text-base md:text-base font-black text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">지출 금액</label>
              <div className="relative">
                <input type="number" placeholder="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-sm text-foreground outline-none font-black text-right pr-8" />
                <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">원</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={downloadExpenseTemplate} className="w-full py-3 bg-muted hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground border border-border rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                <Download size={14} /> 양식
              </button>
              <button onClick={() => excelInputRef.current?.click()} className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground rounded-xl font-bold text-xs shadow-lg shadow-neon transition-all active:scale-95 flex items-center justify-center gap-1">
                <FileSpreadsheet size={14} /> 일괄
              </button>
              <input type="file" ref={excelInputRef} onChange={handleExpenseFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <button onClick={handleAddTransaction} className="w-full py-3 bg-foreground text-background rounded-xl font-bold text-xs shadow-lg shadow-neon transition-all active:scale-95 flex items-center justify-center gap-1">
                <Plus size={14} /> 등록
              </button>
            </div>
          </div>
        </AppCard>

        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-2 px-1 handset-landscape-toolbar">
            <h3 className="font-extrabold text-[22px] text-foreground whitespace-nowrap">최근 지출 내역</h3>
            <div className="relative flex-1 max-w-[200px]">
              <SearchableSelect
                value={expenseSearch}
                onChange={(value) => { setExpenseSearch(value); setShowAllTransactions(false); }}
                options={[
                  { id: '', label: '전체 현장' },
                  ...data.sites.map(site => ({
                    id: site.id,
                    label: site.name
                  }))
                ]}
                placeholder="현장명 검색..."
                recentIds={recentSiteIds}
              />
            </div>
          </div>
          {(() => {
            const filtered = expenseSearch
              ? sortedTransactions.filter(t => resolveSiteId(t.site_id) === expenseSearch)
              : sortedTransactions;
            const displayed = showAllTransactions ? filtered : filtered.slice(0, 5);
            const hasMore = filtered.length > 5 && !showAllTransactions;
            
            if (filtered.length === 0) return <div className="text-center py-10 text-muted-foreground text-xs bg-card rounded-2xl">{expenseSearch ? '검색 결과가 없습니다.' : '지출 내역이 없습니다.'}</div>;
            
            return (
              <>
                {displayed.map(t => {
                  const resolvedSiteId = resolveSiteId(t.site_id);
                  const site = resolvedSiteId ? sitesById.get(resolvedSiteId) : undefined;
                  const worker = data.workers.find(w => w.id === t.worker_id);
                  return (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-card rounded-2xl border border-border shadow-sm">
                      <div className="flex flex-col min-w-0 flex-1 mr-2 cursor-pointer" onClick={() => setEditingTx({ ...t })}>
                        <span className="text-micro-md text-muted-foreground mb-0.5 truncate">{t.date} · {site?.name || '공통경비'}</span>
                        <span className="font-bold text-sm text-foreground truncate">
                          {t.category}
                          {worker && <span className="text-info ml-1">[{worker.name}]</span>}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({t.description})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black text-sm text-red-500">-{formatCurrency(t.amount)}</span>
                        <button onClick={() => setEditingTx({ ...t })} className="text-muted-foreground/50 hover:text-primary"><Edit2 size={14} /></button>
                        <button onClick={() => deleteTransaction(t.id)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button onClick={() => setShowAllTransactions(true)} className="w-full py-3 bg-muted hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground text-xs font-bold rounded-2xl transition-colors border border-border">
                    더보기 ({filtered.length - 5}건 더)
                  </button>
                )}
                {showAllTransactions && filtered.length > 5 && (
                  <button onClick={() => setShowAllTransactions(false)} className="w-full py-3 bg-muted hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground text-xs font-bold rounded-2xl transition-colors border border-border">
                    접기
                  </button>
                )}
                {expenseSearch && (
                  <div className="text-center text-micro-md text-muted-foreground py-1">
                    "{expenseSearch}" 검색결과: {filtered.length}건 · 총 {formatCurrency(filtered.reduce((s, t) => s + t.amount, 0))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Profit Detail Modal */}
      {profitDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-3xl rounded-3xl shadow-2xl p-4 md:p-6 max-h-[90vh] flex flex-col handset-landscape-modal-panel">
            <div className="flex justify-between items-center gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-bold text-foreground truncate">
                  {selectedDetailSite?.name || '현장'} 상세내역
                </h3>
              </div>
              <button
                onClick={closeProfitDetail}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                aria-label="상세 닫기"
              >
                <X className="h-4 w-4 icon-stroke-normal" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setEditingLaborId(null);
                  setProfitDetail((prev) => (prev ? { ...prev, mode: 'labor' } : prev));
                }}
                className={`rounded-xl border px-3 py-2 text-xs md:text-sm font-bold transition-colors ${
                  profitDetail.mode === 'labor'
                    ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
                    : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                노무비 상세 ({selectedLaborDetails.length}건)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setEditingLaborId(null);
                  setProfitDetail((prev) => (prev ? { ...prev, mode: 'expense' } : prev));
                }}
                className={`rounded-xl border px-3 py-2 text-xs md:text-sm font-bold transition-colors ${
                  profitDetail.mode === 'expense'
                    ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800'
                    : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                경비 상세 ({selectedExpenseDetails.length}건)
              </button>
            </div>

            <div className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
              {profitDetail.mode === 'labor' ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-foreground">총 공수 {selectedLaborTotals.md.toFixed(1)}</span>
                  <span className="text-muted-foreground">세금 -{formatCurrency(selectedLaborTotals.tax)}</span>
                  <span className="text-muted-foreground">실지급 -{formatCurrency(selectedLaborTotals.net)}</span>
                  <span className="font-bold text-orange-600 ml-auto">-{formatCurrency(selectedLaborTotals.gross)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">총 {selectedExpenseDetails.length}건</span>
                  <span className="font-bold text-teal-600 ml-auto">-{formatCurrency(selectedExpenseTotal)}</span>
                </div>
              )}
            </div>

            <div ref={detailScrollRef} data-dropdown-boundary className="overflow-y-auto flex-1 pr-0.5 space-y-1.5 overscroll-contain">
              {profitDetail.mode === 'labor' ? (
                selectedLaborDetails.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">노무비 내역이 없습니다.</div>
                ) : (
                  selectedLaborDetails.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1 min-w-0 text-sm md:text-[15px] leading-snug font-bold text-foreground truncate">
                          {row.date} · {row.workerName}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-micro-md px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            {row.md}공수
                          </span>
                          <button
                            type="button"
                            onClick={() => startLaborEdit(row.id)}
                            aria-label="노무비 수정"
                            title="수정"
                            className="h-5 w-5 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <Pen size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-0.5 text-[11px] md:text-xs leading-snug text-muted-foreground">
                        일당 {formatCurrency(row.daily)} · 세금 -{formatCurrency(row.tax)} · 실지급 -{formatCurrency(row.net)}
                      </div>
                      {row.note && (
                        <div className="mt-1 text-[11px] md:text-xs leading-snug text-foreground bg-muted rounded-md px-2 py-1 break-words">{row.note}</div>
                      )}
                      <div className="mt-1 text-right font-black text-sm leading-none text-orange-600">-{formatCurrency(row.gross)}</div>
                      {editingLaborId === row.id && (
                        <div className="mt-2 space-y-2 border border-border rounded-md md:rounded-lg p-2 bg-muted/40">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="date"
                              value={editingLaborDraft.date}
                              onChange={(e) => setEditingLaborDraft((prev) => ({ ...prev, date: e.target.value }))}
                              className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                            />
                            <SearchableSelect
                              options={[{ id: '', label: '작업자 선택' }, ...data.workers.map((w) => ({ id: w.id, label: w.name }))]}
                              value={editingLaborDraft.worker_id}
                              onChange={(val) =>
                                preserveDetailScroll(() =>
                                  setEditingLaborDraft((prev) => ({ ...prev, worker_id: val }))
                                )
                              }
                              placeholder="작업자 선택"
                              recentIds={recentWorkerIds}
                              autoFocusSearch={false}
                              searchable
                            />
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editingLaborDraft.md}
                              onChange={(e) => setEditingLaborDraft((prev) => ({ ...prev, md: e.target.value }))}
                              className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                              placeholder="공수"
                            />
                          </div>
                          <input
                            type="text"
                            value={editingLaborDraft.note}
                            onChange={(e) => setEditingLaborDraft((prev) => ({ ...prev, note: e.target.value }))}
                            className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                            placeholder="메모"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingLaborId(null)}
                              className="px-3 py-1.5 rounded-md md:rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={saveLaborEdit}
                              className="px-3 py-1.5 rounded-md md:rounded-lg bg-orange-500 text-white text-xs font-bold"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : selectedExpenseDetails.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">경비 내역이 없습니다.</div>
              ) : (
                selectedExpenseDetails.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 min-w-0 text-sm md:text-[15px] leading-snug font-bold text-foreground truncate">
                        {row.date} · {row.category}
                        {row.workerName ? ` · ${row.workerName}` : ''}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black text-sm text-teal-600">-{formatCurrency(row.amount)}</span>
                        <button
                          type="button"
                          onClick={() => startExpenseEdit(row.id)}
                          aria-label="경비 수정"
                          title="수정"
                          className="h-5 w-5 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Pen size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] md:text-xs leading-snug text-muted-foreground break-words">{row.description || '-'}</div>
                    {editingExpenseId === row.id && (
                      <div className="mt-2 space-y-2 border border-border rounded-md md:rounded-lg p-2 bg-muted/40">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input
                            type="date"
                            value={editingExpenseDraft.date}
                            onChange={(e) => setEditingExpenseDraft((prev) => ({ ...prev, date: e.target.value }))}
                            className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                          />
                          <SearchableSelect
                            options={[{ id: '', label: '항목 선택' }, ...categories.map((c) => ({ id: c, label: c }))]}
                            value={editingExpenseDraft.category}
                            onChange={(val) =>
                              preserveDetailScroll(() =>
                                setEditingExpenseDraft((prev) => ({ ...prev, category: val }))
                              )
                            }
                            placeholder="항목 선택"
                            autoFocusSearch={false}
                            searchable={false}
                            clearable={false}
                            compact
                          />
                          <input
                            type="number"
                            min="0"
                            value={editingExpenseDraft.amount}
                            onChange={(e) => setEditingExpenseDraft((prev) => ({ ...prev, amount: e.target.value }))}
                            className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                            placeholder="금액"
                          />
                        </div>
                        <input
                          type="text"
                          value={editingExpenseDraft.description}
                          onChange={(e) => setEditingExpenseDraft((prev) => ({ ...prev, description: e.target.value }))}
                          className="w-full px-2.5 py-2 rounded-md md:rounded-lg bg-card border border-border text-xs font-semibold text-foreground outline-none"
                          placeholder="상세 내용"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingExpenseId(null)}
                            className="px-3 py-1.5 rounded-md md:rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={saveExpenseEdit}
                            className="px-3 py-1.5 rounded-md md:rounded-lg bg-teal-600 text-white text-xs font-bold"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 handset-landscape-modal-panel handset-landscape-scroll-panel">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">지출 내역 수정</h3>
              <button onClick={() => setEditingTx(null)} className="p-2 bg-muted rounded-full text-muted-foreground icon-wrapper">
                <X size={16} className="icon-fixed icon-stroke-normal" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">날짜</label>
                <input type="date" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">현장</label>
                <SearchableSelect options={[{ id: '', label: '공통경비 (현장 미지정)' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={editingTx.site_id} onChange={v => setEditingTx({ ...editingTx, site_id: v })} placeholder="현장 선택" recentIds={recentSiteIds} />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">항목</label>
                <div className="relative">
                  <select value={editingTx.category} onChange={e => setEditingTx({ ...editingTx, category: e.target.value })} className="w-full p-2.5 rounded-xl bg-muted border border-border text-body font-semibold text-foreground outline-none appearance-none pr-6">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                </div>
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">내용</label>
                <input type="text" value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">금액 (원)</label>
                <input type="number" value={editingTx.amount} onChange={e => setEditingTx({ ...editingTx, amount: parseInt(e.target.value) || 0 })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-black text-right text-foreground outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { deleteTransaction(editingTx.id); setEditingTx(null); }} className="p-4 rounded-xl bg-red-50 text-red-500 font-bold"><Trash2 size={20} /></button>
                <button onClick={handleSaveEditTx} className="flex-1 py-4 bg-foreground text-background rounded-xl font-bold text-sm shadow-xl">수정사항 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseView;
