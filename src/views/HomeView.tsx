import React, { useState, useRef, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Download, Users, FileUp, Grid, List, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import type { AppState, WorkLog, Worker, Site } from '@/types';
import { formatCurrency, calcPayroll, getSiteTheme, hashString, normalizeText, num, parseKoreanDateToISO, median, toLocalISODate, parseISODateLocal } from '@/lib/helpers';
import MonthYearPicker from '@/components/app/MonthYearPicker';
import SearchableSelect from '@/components/app/SearchableSelect';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { findBestMatch } from '@/lib/siteNameMatcher';
import { decodeCSVBuffer } from '@/lib/csvUtils';

interface HomeViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  setLogModalOpen: (o: boolean) => void;
  setLogModalDate: (d: string) => void;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const HomeView = ({ data, setData, addToast, selectedDate, setSelectedDate, setLogModalOpen, setLogModalDate, recentSiteIds, recentWorkerIds }: HomeViewProps) => {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1); // current month as default
  });
  const [calFilterSite, setCalFilterSite] = useState('');
  const [calFilterWorker, setCalFilterWorker] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [payMonthOverride, setPayMonthOverride] = useState<Date | null>(null);
  const [payShowAll, setPayShowAll] = useState(true);
  const payMonth = payMonthOverride || calMonth;
  const setPayMonth = (d: Date) => { setPayMonthOverride(d); setPayShowAll(false); };
  const [payDateDesc, setPayDateDesc] = useState(true);
  const [monthYearPickerOpen, setMonthYearPickerOpen] = useState(false);
  const [monthYearPickerViewYear, setMonthYearPickerViewYear] = useState(calMonth.getFullYear());


  const payrollCsvInputRef = useRef<HTMLInputElement>(null);

  const workersById = useMemo(() => Object.fromEntries(data.workers.map(w => [w.id, w] as const)), [data.workers]);
  const sitesById = useMemo(() => Object.fromEntries(data.sites.map(s => [s.id, s] as const)), [data.sites]);
  const isHolidaySiteId = useCallback((siteId: string) => {
    const siteNameKey = normalizeText(sitesById[siteId]?.name || '').toLowerCase().replace(/\s+/g, '');
    return siteNameKey.includes('휴무');
  }, [sitesById]);
  const getEffectiveMd = useCallback((siteId: string, md: number) => (isHolidaySiteId(siteId) ? 0 : md), [isHolidaySiteId]);

  const importPayrollCsv = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const text = decodeCSVBuffer(buf);

      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
      const rows: Record<string, unknown>[] = Array.isArray(parsed.data) ? parsed.data as Record<string, unknown>[] : [];
      if (rows.length === 0) { addToast('CSV 데이터가 비어있습니다.', 'error'); return; }

      const normalizeNameKey = (v: string) => normalizeText(v).toLowerCase().replace(/\s+/g, '');
      const existingWorkersByName = new Map(data.workers.map(w => [normalizeNameKey(w.name), w] as const));
      const existingSitesByName = new Map(data.sites.map(s => [normalizeNameKey(s.name), s] as const));
      const workerDailyCandidates: Record<string, number[]> = {};
      const siteCompanyCandidates: Record<string, Record<string, number>> = {};

      const normalized = rows.map(r => {
        const workerName = normalizeText(r['작업자'] ?? r['worker'] ?? '');
        const dateISO = parseKoreanDateToISO(String(r['일자'] ?? r['date'] ?? ''));
        const company = normalizeText(r['거래처'] ?? r['company'] ?? '');
        const siteName = normalizeText(r['예산현장명'] ?? r['현장'] ?? r['site'] ?? '미지정') || '미지정';
        const md = num(r['공수'] ?? r['md'] ?? 0, 0);
        const gross = num(r['총급여'] ?? r['gross'] ?? 0, 0);
        const note = normalizeText(r['메모'] ?? r['note'] ?? '');
        if (workerName && md > 0 && gross > 0) {
          const daily = Math.round((gross / md) / 100) * 100;
          if (!workerDailyCandidates[workerName]) workerDailyCandidates[workerName] = [];
          workerDailyCandidates[workerName].push(daily);
        }
        if (siteName) {
          if (!siteCompanyCandidates[siteName]) siteCompanyCandidates[siteName] = {};
          if (company) siteCompanyCandidates[siteName][company] = (siteCompanyCandidates[siteName][company] || 0) + 1;
        }
        return { workerName, dateISO, company, siteName, md, note };
      }).filter(r => r.workerName && r.dateISO && r.md > 0 && r.siteName);

      if (normalized.length === 0) { addToast('CSV 컬럼을 확인해주세요. (작업자/일자/현장/공수)', 'error'); return; }

      const workerIdByName: Record<string, string> = {};
      const mergedWorkers: Worker[] = [...data.workers];
      for (const name of new Set([...Object.keys(workerDailyCandidates), ...normalized.map(r => r.workerName)])) {
        const nameKey = normalizeNameKey(name);
        const existed = existingWorkersByName.get(nameKey);
        if (existed) {
          const med = median(workerDailyCandidates[name] || []);
          workerIdByName[name] = existed.id;
          const idx = mergedWorkers.findIndex(w => w.id === existed.id);
          if (idx >= 0 && med > 0) mergedWorkers[idx] = { ...mergedWorkers[idx], daily: med };
        } else {
          const med = median(workerDailyCandidates[name] || []);
          const id = crypto.randomUUID();
          workerIdByName[name] = id;
          const created = { id, name, daily: med > 0 ? med : 150000 };
          mergedWorkers.push(created);
          existingWorkersByName.set(nameKey, created);
        }
      }

      const siteIdByName: Record<string, string> = {};
      const mergedSites: Site[] = [...data.sites];
      for (const siteName of new Set([...Object.keys(siteCompanyCandidates), ...normalized.map(r => r.siteName)])) {
        const siteKey = normalizeNameKey(siteName);
        const existed = existingSitesByName.get(siteKey);
        const companyCounts = siteCompanyCandidates[siteName] || {};
        const topCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || existed?.company_name || '';
        if (existed) {
          siteIdByName[siteName] = existed.id;
          const idx = mergedSites.findIndex(s => s.id === existed.id);
          if (idx >= 0) mergedSites[idx] = { ...mergedSites[idx], company_name: topCompany || mergedSites[idx].company_name };
        } else {
          // 스마트 매칭: 약칭/정규화로 기존 현장 검색
          const match = findBestMatch(siteName, data.sites);
          if (match) {
            siteIdByName[siteName] = match.siteId;
            existingSitesByName.set(siteKey, data.sites.find(s => s.id === match.siteId)!);
            const idx = mergedSites.findIndex(s => s.id === match.siteId);
            if (idx >= 0) mergedSites[idx] = { ...mergedSites[idx], company_name: topCompany || mergedSites[idx].company_name };
          } else {
            const id = crypto.randomUUID();
            const created = { id, name: siteName, company_name: topCompany, budget: 0, status: 'active' as const };
            siteIdByName[siteName] = id;
            mergedSites.push(created);
            existingSitesByName.set(siteKey, created);
          }
        }
      }

      const seen = new Set<string>();
      const importedLogs: WorkLog[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const r = normalized[i];
        const worker_id = workerIdByName[r.workerName];
        const site_id = siteIdByName[r.siteName];
        const key = `${r.dateISO}|${worker_id}|${site_id}|${r.md}`;
        if (seen.has(key)) continue;
        seen.add(key);
        importedLogs.push({ id: crypto.randomUUID(), date: r.dateISO, site_id, worker_id, md: r.md, note: r.note || '' });
      }

      const latest = importedLogs.map(l => l.date).sort().slice(-1)[0];
      if (latest) {
        const d = parseISODateLocal(latest);
        if (d) {
          setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          setPayMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
        setSelectedDate(latest);
      }

      // 기존 데이터와 병합 (중복 제거: date+worker_id+site_id+md 기준)
      setData(prev => {
        const existingKeys = new Set(prev.workLogs.map(l => `${l.date}|${l.worker_id}|${l.site_id}|${l.md}`));
        const newLogs = importedLogs.filter(l => !existingKeys.has(`${l.date}|${l.worker_id}|${l.site_id}|${l.md}`));
        const skipped = importedLogs.length - newLogs.length;
        if (skipped > 0) {
          addToast(`${skipped}건 중복 제외`, 'info');
        }
        return { ...prev, workers: mergedWorkers, sites: mergedSites, workLogs: [...prev.workLogs, ...newLogs] };
      });
      setPayShowAll(true);
      
      addToast(`CSV 반영 완료 · 작업일지 ${importedLogs.length}건`, 'success');
    } catch (e: unknown) {
      console.error(e);
      addToast(`CSV 반영 실패: ${(e as Error)?.message || '오류'}`, 'error');
    }
  };

  const payrollData = useMemo(() => {
    // sort/filter on a cloned array to avoid mutating source state order
    let logs = [...data.workLogs];
    if (!payShowAll) {
      const y = payMonth.getFullYear();
      const m = payMonth.getMonth() + 1;
      const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;
      logs = logs.filter(l => l.date.startsWith(monthPrefix));
    }
    // 상단 현장/작업자 필터를 급여표에도 동일하게 적용
    if (calFilterWorker) logs = logs.filter(l => workersById[l.worker_id]?.name === calFilterWorker);
    if (calFilterSite) logs = logs.filter(l => sitesById[l.site_id]?.name === calFilterSite);
    if (payDateDesc) {
      logs.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      logs.sort((a, b) => a.date.localeCompare(b.date));
    }
    let result = logs.map(log => {
      const worker = workersById[log.worker_id];
      const site = sitesById[log.site_id];
      const effectiveMd = getEffectiveMd(log.site_id, log.md);
      const { gross, tax, net } = calcPayroll(worker?.daily || 0, effectiveMd);
      return {
        ...log,
        md: effectiveMd,
        workerName: worker?.name || '미등록',
        siteName: site?.name || '삭제된 현장',
        companyName: site?.company_name || '-',
        gross,
        tax,
        net,
      };
    });
    return result;
  }, [data.workLogs, payMonth, payShowAll, calFilterWorker, calFilterSite, payDateDesc, workersById, sitesById, getEffectiveMd]);

  const totals = payrollData.reduce((acc, curr) => ({ md: acc.md + curr.md, gross: acc.gross + curr.gross, tax: acc.tax + curr.tax, net: acc.net + curr.net }), { md: 0, gross: 0, tax: 0, net: 0 });

  const exportToExcel = () => {
    const excelData = payrollData.map(row => ({
      '작업자': row.workerName, '일자': row.date, '거래처': row.companyName, '현장': row.siteName,
      '공수': row.md, '총급여': row.gross, '세금(3.3%)': -row.tax, '실수령액': row.net, '메모': row.note || '',
    }));
    excelData.push({ '작업자': '합계', '일자': '', '거래처': '', '현장': '', '공수': totals.md, '총급여': totals.gross, '세금(3.3%)': -totals.tax, '실수령액': totals.net, '메모': '' });
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '출력현황');
    const fileSuffix = payShowAll
      ? 'all'
      : `${payMonth.getFullYear()}_${String(payMonth.getMonth() + 1).padStart(2, '0')}`;
    XLSX.writeFile(wb, `출력현황_${fileSuffix}.xlsx`);
    addToast('엑셀 다운로드 완료', 'success');
  };

  const generateCalendar = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = toLocalISODate();
    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-border bg-muted/30 dark:border-[#3a3a3a] dark:bg-[#262626] handset-landscape-calendar-cell"></div>);

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today === dateStr;
      const isSelected = selectedDate === dateStr;

      const dayLogs = data.workLogs.filter(l => {
        const dateMatch = l.date === dateStr;
        const workerMatch = calFilterWorker ? workersById[l.worker_id]?.name === calFilterWorker : true;
        const siteMatch = calFilterSite ? sitesById[l.site_id]?.name === calFilterSite : true;
        return dateMatch && workerMatch && siteMatch;
      });

      const logsBySite = dayLogs.reduce((acc, log) => {
        if (!acc[log.site_id]) acc[log.site_id] = [];
        acc[log.site_id].push(log);
        return acc;
      }, {} as Record<string, WorkLog[]>);

      days.push(
        <div key={d} onClick={() => { setSelectedDate(dateStr); setLogModalDate(dateStr); setLogModalOpen(true); }}
          className={`min-h-[80px] border-r border-b border-border dark:border-[#3a3a3a] p-0.5 cursor-pointer transition-colors relative group flex flex-col handset-landscape-calendar-cell ${isSelected ? 'bg-accent/15 ring-2 ring-inset ring-primary dark:bg-[#3c3c3c] dark:ring-[#7aa2ff]' : isToday ? 'bg-accent/50 dark:bg-[#353535]' : 'bg-card dark:bg-[#2f2f2f]'} ${!isSelected ? 'hover:bg-muted dark:hover:bg-[#3a3a3a]' : ''}`}
        >
          <div className={`text-xs font-bold px-0.5 mb-0.5 handset-landscape-calendar-date ${isToday ? 'text-primary dark:text-[#a6c8ff]' : 'text-foreground dark:text-[#f3f3f3]'}`}>{d}</div>
          <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
            {(() => {
              const siteEntries = Object.entries(logsBySite);
              const MAX_LINES = 5;
              // Count total lines needed
              let totalLines = 0;
              const siteData = siteEntries.map(([siteId, logs]) => {
                const siteLogs = logs as WorkLog[];
                const site = sitesById[siteId];
                const theme = getSiteTheme(siteId);
                const mdGroups: Record<number, string[]> = {};
                siteLogs.forEach(log => {
                  const effectiveMd = getEffectiveMd(log.site_id, log.md);
                  const workerName = workersById[log.worker_id]?.name || '?';
                  const displayName = workerName.slice(0, 1);
                  if (!mdGroups[effectiveMd]) mdGroups[effectiveMd] = [];
                  mdGroups[effectiveMd].push(displayName);
                });
                const lines = 1 + Object.keys(mdGroups).length; // title + worker lines
                totalLines += lines;
                return { siteId, site, theme, mdGroups, siteLogs, lines };
              });

              const needsTruncate = totalLines > MAX_LINES;
              let usedLines = 0;

              return (
                <>
                  {siteData.map(({ siteId, site, theme, mdGroups, siteLogs, lines }, idx) => {
                    if (needsTruncate && usedLines >= MAX_LINES - 1) {
                      if (idx === siteData.length - 1 || usedLines === MAX_LINES - 1) {
                        const remaining = siteData.slice(idx).reduce((s, d) => s + d.siteLogs.length, 0);
                        return <div key="more" className="text-muted-foreground dark:text-[#e0e0e0] text-center font-bold" style={{ fontSize: '9px', lineHeight: '13px' }}>+{remaining}건</div>;
                      }
                      return null;
                    }
                    usedLines += lines;
                    return (
                      <div
                        key={siteId}
                        className={`rounded-[2px] px-0.5 border handset-landscape-calendar-entry ${theme.border} ${theme.header}`}
                        style={{ ...(theme.styleVars as React.CSSProperties), fontSize: '10px', lineHeight: '13px' }}
                      >
                        <span className="font-bold">{site?.name?.slice(0, 4) || '미지정'}</span>
                        {Object.entries(mdGroups).map(([md, names]) => (
                          <div key={md} className={`opacity-80 dark:opacity-95 ${md === '0' || md === '0.5' ? 'text-red-500 dark:text-red-300 font-bold' : ''}`}>
                            {md === '0' ? (
                              <>
                                {names.map((n, i) => <span key={i}>({n})</span>)}
                                <span className="ml-0.5 text-red-500 dark:text-red-300">휴무</span>
                              </>
                            ) : (
                              <>
                                {names.map((n, i) => <span key={i}>({n})</span>)}
                                <span className={`ml-0.5 font-bold ${md === '0.5' ? 'text-red-500 dark:text-red-300' : ''}`}>{md}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      );
    }
    return days;
  };

  const generateListView = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = toLocalISODate();
    const daysList: React.ReactNode[] = [];

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(year, month, d);
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
      const isToday = today === dateStr;

      const dayLogs = data.workLogs.filter(l => {
        const dateMatch = l.date === dateStr;
        const workerMatch = calFilterWorker ? workersById[l.worker_id]?.name === calFilterWorker : true;
        const siteMatch = calFilterSite ? sitesById[l.site_id]?.name === calFilterSite : true;
        return dateMatch && workerMatch && siteMatch;
      });
      const isEmpty = dayLogs.length === 0;

      daysList.push(
        <div key={d} onClick={() => { setSelectedDate(dateStr); setLogModalDate(dateStr); setLogModalOpen(true); }}
          className={`flex items-start gap-4 p-4 border-b last:border-0 border-border cursor-pointer hover:bg-muted transition-colors ${isToday ? 'bg-accent/30' : ''}`}
        >
          <div className="flex flex-col items-center justify-center min-w-[3rem]">
            <span className={`text-lg font-bold ${dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : 'text-foreground'}`}>{d}</span>
            <span className="text-xs text-muted-foreground">{dayOfWeek}</span>
          </div>
          <div className="flex-1">
            {isEmpty ? (
              <div className="text-xs text-muted-foreground/40 py-1">일정 없음</div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(dayLogs.reduce((acc, log) => { if (!acc[log.site_id]) acc[log.site_id] = []; acc[log.site_id].push(log); return acc; }, {} as Record<string, WorkLog[]>)).map(([siteId, logs]) => {
                  const site = sitesById[siteId];
                  const theme = getSiteTheme(siteId);
                  const siteLogs = logs as WorkLog[];
                  const mdGroups: Record<number, string[]> = {};
                  siteLogs.forEach(log => {
                    const effectiveMd = getEffectiveMd(log.site_id, log.md);
                    const wName = workersById[log.worker_id]?.name || '?';
                    const displayName = `(${wName.slice(0, 1)})`;
                    if (!mdGroups[effectiveMd]) mdGroups[effectiveMd] = [];
                    mdGroups[effectiveMd].push(displayName);
                  });
                  return (
                    <div key={siteId} className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center text-micro-lg font-bold px-2 py-1 rounded-lg border ${theme.border} ${theme.header}`}
                        style={{ ...(theme.styleVars as React.CSSProperties) }}
                      >
                        {site?.name || '미지정'}
                      </span>
                      {Object.entries(mdGroups).map(([md, names]) => (
                        <span key={md} className="text-micro-lg text-muted-foreground">
                          {md === '0' ? (
                            <span className="font-bold text-red-500 dark:text-red-300">{names.join('')} 휴무</span>
                          ) : (
                            <>
                              {names.join('')} <span className="font-bold text-foreground">{md}공수</span>
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    return daysList;
  };

  return (
    <div className="animate-fade-in pb-24 space-y-6 handset-landscape-view">
      {/* Calendar Section */}
      <div>
        <div className="flex flex-col gap-4 mb-4">
          {/* 최상단: 필터 섹션 (현장 + 작업자) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 현장' }, ...data.sites.map(s => ({ id: s.name, label: s.name }))]} value={calFilterSite} onChange={setCalFilterSite} placeholder="현장 필터" recentIds={recentSiteIds} />
            </div>
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 작업자' }, ...data.workers.map(w => ({ id: w.name, label: w.name }))]} value={calFilterWorker} onChange={setCalFilterWorker} placeholder="작업자 필터" recentIds={recentWorkerIds} />
            </div>
          </div>
          
          {/* 통합 제어 바 - ChecklistView 스타일 적용 */}
          <div className="flex items-center w-full box-border px-0 md:px-8 gap-1 md:gap-3 mb-4 h-[44px]">
            {/* 좌측: 액션 버튼 그룹 */}
            <div className="flex items-center gap-1 flex-[1.3] h-full min-w-0">
              <button 
                onClick={() => payrollCsvInputRef.current?.click()} 
                className="flex-1 p-1 md:p-2.5 rounded-full transition-all flex items-center justify-center h-full border-none gap-1 min-w-0 shadow-sm bg-primary text-primary-foreground hover:brightness-110"
                title="CSV 불러오기"
              >
                <FileUp size={14} className="flex-shrink-0" />
                <span className="text-xs font-bold truncate">업로드</span>
              </button>
              <input ref={payrollCsvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { importPayrollCsv(f); } (e.target as HTMLInputElement).value = ''; }} />
              <button onClick={() => { setLogModalDate(selectedDate); setLogModalOpen(true); }} className="flex-1 p-1 md:p-2.5 rounded-full bg-card border border-border text-muted-foreground transition-all flex items-center justify-center h-full gap-1 min-w-0 shadow-sm hover:text-foreground" title="공수등록">
                <Users size={14} className="flex-shrink-0" />
                <span className="text-xs font-bold truncate">공수</span>
              </button>
            </div>
            
            {/* 구분선 */}
            
            {/* 우측: 뷰 전환 탭 메뉴 - AdminView 스타일 적용 */}
            <div className="flex flex-1 h-full rounded-2xl bg-muted/80 border border-border/60 p-0.5 shadow-inner gap-0.5 min-w-0">
              <button 
                onClick={() => setViewMode('calendar')} 
                className={`flex-1 rounded-2xl transition-all text-xs font-bold flex items-center justify-center ${
                  viewMode === 'calendar' 
                    ? 'bg-white dark:bg-black text-primary shadow-sm border border-border' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                달력
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={`flex-1 rounded-2xl transition-all text-xs font-bold flex items-center justify-center ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-black text-primary shadow-sm border border-border' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                목록
              </button>
            </div>
          </div>
          
          {/* 날짜 네비게이션과 캘린더 통합 컨테이너 */}
          <div className="bg-card dark:bg-[#1f1f1f] rounded-2xl shadow-sm border border-border dark:border-[#3a3a3a] overflow-hidden handset-landscape-calendar-shell">
            <div className="flex justify-center items-center gap-4 p-4 border-b border-border dark:border-[#3a3a3a] bg-muted/50 dark:bg-[#262626]">
              <button 
                onClick={(e) => { e.stopPropagation(); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); }} 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#353535] text-muted-foreground dark:text-[#d6d6d6] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => { setMonthYearPickerOpen(!monthYearPickerOpen); }} 
                  className="text-center text-lg font-bold text-foreground dark:text-[#f3f3f3] min-w-[120px] hover:text-primary transition-colors cursor-pointer"
                >
                  {calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월
                </button>
                {monthYearPickerOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card dark:bg-[#242424] border border-border dark:border-[#3a3a3a] rounded-2xl shadow-2xl z-50 w-64 p-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => setMonthYearPickerViewYear(monthYearPickerViewYear - 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#353535] rounded-full"><ChevronLeft size={16} /></button>
                      <span className="font-bold text-lg text-foreground dark:text-[#f3f3f3]">{monthYearPickerViewYear}년</span>
                      <button onClick={() => setMonthYearPickerViewYear(monthYearPickerViewYear + 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#353535] rounded-full"><ChevronRight size={16} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 12 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => { setCalMonth(new Date(monthYearPickerViewYear, i, 1)); setMonthYearPickerOpen(false); }}
                          className={`h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${calMonth.getMonth() === i && calMonth.getFullYear() === monthYearPickerViewYear ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100 dark:hover:bg-[#353535] text-muted-foreground dark:text-[#d6d6d6]'}`}
                        >
                          {i + 1}월
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); }} 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#353535] text-muted-foreground dark:text-[#d6d6d6] transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            {/* 캘린더 콘텐츠 */}
            {viewMode === 'calendar' ? (
              <>
                <div className="grid grid-cols-7 border-b border-border dark:border-[#3a3a3a] bg-muted/50 dark:bg-[#262626] handset-landscape-calendar-weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                    <div key={d} className={`text-center py-3 text-xs font-bold ${i === 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground dark:text-[#d6d6d6]'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 handset-landscape-calendar-grid">{generateCalendar()}</div>
              </>
            ) : (
              <div>{generateListView()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Payroll Table Section */}
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-sans font-extrabold text-[20px] md:text-[22px] text-foreground whitespace-nowrap">
            출력현황
          </h3>
        </div>
        <div className="flex gap-1.5 ml-auto h-[40px] items-center min-w-0 flex-shrink">
          <div
            className={`h-full rounded-full border transition-all whitespace-nowrap flex items-center justify-center min-w-[136px] sm:min-w-[152px] px-1.5 sm:px-2 flex-shrink ${
              !payShowAll
                ? 'bg-primary/10 border-primary shadow-sm'
                : 'bg-card border-border shadow-sm'
            }`}
          >
            <MonthYearPicker date={payMonth} onChange={setPayMonth} showAll={payShowAll} onSelectAll={() => setPayShowAll(true)} />
          </div>
          <button 
            onClick={exportToExcel} 
            className="h-full w-10 sm:w-auto px-0 sm:px-4 rounded-full transition-all whitespace-nowrap flex items-center justify-center gap-1 border-none shadow-sm bg-primary text-primary-foreground hover:brightness-110 flex-shrink-0"
          >
            <Download size={14} />
            <span className="hidden sm:inline text-xs font-bold truncate">다운로드</span>
          </button>
        </div>
      </div>
      
      {/* 집계 정보 */}
      <div className="mb-4">
        <div className="bg-muted rounded-xl px-4 py-2 border border-border h-[44px] flex items-center w-full">
          <div className="flex w-full items-center justify-between gap-3 text-[14px] font-bold handset-landscape-summary-row">
            <span>{payShowAll ? '전체 기간' : `${String(payMonth.getFullYear()).slice(2)}년 ${payMonth.getMonth() + 1}월`}</span>
            <span>현장 {new Set(payrollData.filter(r => r.md > 0).map(r => r.siteName)).size}개</span>
            <span className="text-primary text-[14px]">총 공수 {totals.md}</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-soft border border-transparent dark:border-border w-full">
        {/* 모바일 카드 뷰 */}
        <div className="md:hidden handset-landscape-show-block">
          {payrollData.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">데이터가 없습니다.</div>
          ) : (
            <div className="space-y-2 handset-landscape-card-grid">
              {payrollData.map((row, idx) => (
                <div key={`${row.id}-${idx}`} className="bg-card border border-border p-2 rounded-6px">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">{row.workerName}</span>
                    <span className="text-xs text-muted-foreground font-medium">{row.date}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{row.siteName}</span>
                    <span className="font-bold text-teal-500">{formatCurrency(row.net)}</span>
                  </div>
                </div>
              ))}
              
              {/* 합계 */}
              {payrollData.length > 0 && (
                <div className="bg-muted border border-border p-2 text-center rounded-6px">
                  <div className="text-xs font-bold">합계: 총 공수 {totals.md} | 실수령액 {formatCurrency(totals.net)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 데스크톱 테이블 뷰 */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border w-full handset-landscape-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-[700px] w-full text-[11px] md:text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">작업자</th>
                <th className="py-2 px-2 whitespace-nowrap cursor-pointer select-none" onClick={() => setPayDateDesc(prev => !prev)}>
                  일자 {payDateDesc ? '↓' : '↑'}
                </th>
                <th className="py-2 px-2 whitespace-nowrap">거래처</th>
                <th className="py-2 px-2 whitespace-nowrap">현장</th>
                <th className="py-2 px-2 text-center whitespace-nowrap">공수</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">총급여</th>
                <th className="py-2 px-2 text-right text-red-500 whitespace-nowrap">세금(3.3%)</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">실수령액</th>
                <th className="py-2 px-2 whitespace-nowrap">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payrollData.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">데이터가 없습니다.</td></tr>
              ) : (
                payrollData.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">{row.workerName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-medium whitespace-nowrap">{row.date}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-medium whitespace-nowrap max-w-[100px] truncate">{row.companyName}</td>
                    <td className="py-2.5 px-3 text-foreground whitespace-nowrap">{row.siteName}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${row.md === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-primary text-primary-foreground'}`}>
                        {row.md === 0 ? '휴무' : row.md}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground font-medium whitespace-nowrap">{formatCurrency(row.gross)}</td>
                    <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">-{formatCurrency(row.tax)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatCurrency(row.net)}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">{row.note}</td>
                  </tr>
                ))
              )}
            </tbody>
            {payrollData.length > 0 && (
              <tfoot className="bg-blue-50 dark:bg-blue-900/10 font-black text-blue-900 dark:text-blue-100 border-t-2 border-blue-100 dark:border-blue-900/30">
                <tr>
                  <td colSpan={4} className="py-3 px-3 text-center whitespace-nowrap">합계</td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">{totals.md}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">{formatCurrency(totals.gross)}</td>
                  <td className="py-3 px-3 text-right text-red-500 whitespace-nowrap">-{formatCurrency(totals.tax)}</td>
                  <td className="py-3 px-3 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">{formatCurrency(totals.net)}</td>
                  <td className="py-3 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
