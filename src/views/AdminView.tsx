import React, { useState, useRef, useMemo } from 'react';
import { Building2, Users, Plus, Edit2, Trash2, X, FileUp, Search } from 'lucide-react';
import type { AppState, Site, Worker, SiteStatus } from '@/types';
import { formatCurrency, hashString } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';
import AppBadge from '@/components/app/AppBadge';
import SearchableSelect from '@/components/app/SearchableSelect';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface AdminViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const AdminView = ({ data, setData, addToast }: AdminViewProps) => {
  const [activeTab, setActiveTab] = useState<'sites' | 'workers' | 'customers'>('sites');
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const siteExcelInputRef = useRef<HTMLInputElement>(null);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState<SiteStatus | 'all'>('all');
  const [workerSearch, setWorkerSearch] = useState('');
  
  // 거래처 관리 상태
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; contact: string }>>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; name: string; contact: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredSites = useMemo(() => {
    return data.sites.filter(s => {
      const matchesSearch = !siteSearch || s.name.toLowerCase().includes(siteSearch.toLowerCase()) || (s.company_name || '').toLowerCase().includes(siteSearch.toLowerCase());
      const matchesStatus = siteStatusFilter === 'all' || s.status === siteStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.sites, siteSearch, siteStatusFilter]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return data.workers;
    return data.workers.filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()));
  }, [data.workers, workerSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (customer.contact && customer.contact.toLowerCase().includes(customerSearch.toLowerCase()))
    );
  }, [customers, customerSearch]);

  const initialSite: Site = { id: '', name: '', budget: 0, company_name: '', status: 'scheduled' };
  const initialWorker: Worker = { id: '', name: '', daily: 150000 };

  const openCreateSiteModal = () => {setEditingSite({ ...initialSite });setIsSiteModalOpen(true);};
  const openEditSiteModal = (site: Site) => {setEditingSite({ ...site });setIsSiteModalOpen(true);};
  const openCreateWorkerModal = () => {setEditingWorker({ ...initialWorker });setIsWorkerModalOpen(true);};
  const openEditWorkerModal = (worker: Worker) => {setEditingWorker({ ...worker });setIsWorkerModalOpen(true);};
  
  // 거래처 관리 함수들
  const openCreateCustomerModal = () => {
    setEditingCustomer({ id: '', name: '', contact: '' });
    setIsCustomerModalOpen(true);
  };
  const openEditCustomerModal = (customer: { id: string; name: string; contact: string }) => {
    setEditingCustomer({ ...customer });
    setIsCustomerModalOpen(true);
  };
  const saveCustomer = () => {
    if (!editingCustomer?.name?.trim()) {
      addToast('거래처명을 입력해주세요', 'error');
      return;
    }
    
    if (editingCustomer.id) {
      // 기존 거래처 수정
      setCustomers(customers.map(c => 
        c.id === editingCustomer.id ? editingCustomer : c
      ));
      addToast('거래처가 수정되었습니다.', 'success');
    } else {
      // 새 거래처 추가
      const newCustomer = {
        ...editingCustomer,
        id: Date.now().toString(),
      };
      setCustomers([...customers, newCustomer]);
      addToast('거래처가 추가되었습니다.', 'success');
    }
    
    setIsCustomerModalOpen(false);
  };
  const deleteCustomer = (customer: { id: string; name: string; contact: string }) => {
    if (window.confirm(`"${customer.name}" 거래처를 삭제하시겠습니까?`)) {
      setCustomers(customers.filter(c => c.id !== customer.id));
      addToast('거래처가 삭제되었습니다.', 'success');
    }
  };

  const findColumn = (headers: string[], candidates: string[]): string | null => {
    const normalize = (s: string) => s.replace(/\uFEFF/g, '').toLowerCase().normalize('NFC').replace(/[_\s\u200B\u00A0]+/g, '').trim();
    const normCandidates = candidates.map(normalize);
    // Exact match
    for (const h of headers) {
      const nh = normalize(h);
      if (normCandidates.includes(nh)) return h;
    }
    // Contains match
    for (const h of headers) {
      const nh = normalize(h);
      if (normCandidates.some(c => nh.includes(c) || c.includes(nh))) return h;
    }
    return null;
  };

  const cleanHeaders = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (!rows.length) return rows;
    const originalKeys = Object.keys(rows[0]);
    const cleanMap = new Map<string, string>();
    for (const key of originalKeys) {
      cleanMap.set(key, key.replace(/\uFEFF/g, '').trim());
    }
    return rows.map(row => {
      const cleaned: Record<string, unknown> = {};
      for (const [orig, clean] of cleanMap) {
        cleaned[clean] = row[orig];
      }
      return cleaned;
    });
  };

  const normalizeNameKey = (v: unknown) =>
    String(v ?? '')
      .replace(/\uFEFF/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

  const processSiteRows = (rawData: Record<string, unknown>[]) => {
    const jsonData = cleanHeaders(rawData);
    if (!jsonData?.length) { addToast('데이터가 없습니다.', 'error'); return; }
    const headers = Object.keys(jsonData[0]);
    const nameCol = findColumn(headers, ['현장명', '현장', 'name', 'site']);
    const budgetCol = findColumn(headers, ['예산', 'budget', 'amount']);
    const companyCol = findColumn(headers, ['거래처', '건설사', 'company', 'customer']);

    if (!nameCol) { addToast(`현장명 컬럼을 찾을 수 없습니다. (감지된 헤더: ${headers.join(', ')})`, 'error'); return; }

    const norm = (v: unknown) => String(v ?? '').trim();
    const newSites: Site[] = [];
    const updatedSites: Site[] = [];
    const existingMap = new Map(data.sites.map((s) => [normalizeNameKey(s.name), s]));
    for (const row of jsonData) {
      const name = norm(row[nameCol!]);
      if (!name) continue;
      const nameKey = normalizeNameKey(name);
      const rawBudget = budgetCol ? row[budgetCol] : 0;
      const budget = typeof rawBudget === 'number' ? rawBudget : parseInt(String(rawBudget ?? '0').replace(/,/g, '')) || 0;
      const company = companyCol ? norm(row[companyCol]) : '';
      const existingSite = existingMap.get(nameKey);
      if (existingSite) {
        if (existingSite.budget !== budget || (company && existingSite.company_name !== company)) {
          updatedSites.push({ ...existingSite, budget: budget as number, ...(company ? { company_name: company } : {}) });
        }
      } else {
        const id = crypto.randomUUID();
        newSites.push({ id, name, budget: budget as number, company_name: company, status: 'active' });
        existingMap.set(nameKey, newSites[newSites.length - 1]);
      }
    }
    if (newSites.length === 0 && updatedSites.length === 0) { addToast('변경할 현장이 없습니다.', 'info'); return; }
    const updatedIds = new Set(updatedSites.map(s => s.id));
    setData((prev) => ({
      ...prev,
      sites: [...prev.sites.map(s => updatedIds.has(s.id) ? updatedSites.find(u => u.id === s.id)! : s), ...newSites],
    }));
    const msgs: string[] = [];
    if (newSites.length > 0) msgs.push(`${newSites.length}개 추가`);
    if (updatedSites.length > 0) msgs.push(`${updatedSites.length}개 업데이트`);
    addToast(`현장 ${msgs.join(', ')}되었습니다.`, 'success');
  };

  const handleSiteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processSiteRows(results.data as Record<string, unknown>[]);
          if (siteExcelInputRef.current) siteExcelInputRef.current.value = '';
        },
        error: () => { addToast('CSV 업로드 오류', 'error'); if (siteExcelInputRef.current) siteExcelInputRef.current.value = ''; }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataArr = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
          processSiteRows(jsonData);
        } catch (err) { console.error(err); addToast('엑셀 업로드 오류', 'error'); } finally
        { if (siteExcelInputRef.current) siteExcelInputRef.current.value = ''; }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSaveSite = () => {
    if (!editingSite || !editingSite.name) return;
    let newSite = { ...editingSite };
    if (!newSite.id) newSite.id = crypto.randomUUID();

    const duplicatedByName = data.sites.find(
      (s) => normalizeNameKey(s.name) === normalizeNameKey(newSite.name) && s.id !== newSite.id
    );
    if (duplicatedByName) {
      if (editingSite.id) {
        addToast('동일한 현장명이 이미 존재합니다. 이름을 확인해주세요.', 'error');
        return;
      }

      const mergedSite = {
        ...duplicatedByName,
        budget: newSite.budget,
        company_name: newSite.company_name || duplicatedByName.company_name,
        status: newSite.status || duplicatedByName.status,
      };
      setData((prev) => ({
        ...prev,
        sites: prev.sites.map((s) => (s.id === duplicatedByName.id ? mergedSite : s)),
      }));
      addToast('동일 현장으로 병합하여 업데이트했습니다.', 'info');
      setIsSiteModalOpen(false);setEditingSite(null);
      return;
    }

    if (data.sites.find((s) => s.id === newSite.id)) {
      setData((prev) => ({ ...prev, sites: prev.sites.map((s) => s.id === newSite.id ? newSite : s) }));
      addToast('현장 정보가 수정되었습니다.', 'success');
    } else {
      setData((prev) => ({ ...prev, sites: [...prev.sites, newSite] }));
      addToast('새 현장이 추가되었습니다.', 'success');
    }
    setIsSiteModalOpen(false);setEditingSite(null);
  };

  const handleDeleteSite = (id: string) => {
    if (confirm('현장을 삭제하시겠습니까?')) {
      setData((prev) => ({ ...prev, sites: prev.sites.filter((s) => s.id !== id) }));
      addToast('현장이 삭제되었습니다.', 'info');
      setIsSiteModalOpen(false);
    }
  };

  const handleSaveWorker = () => {
    if (!editingWorker || !editingWorker.name) return;
    let newWorker = { ...editingWorker };
    if (!newWorker.id) newWorker.id = crypto.randomUUID();

    const duplicatedByName = data.workers.find(
      (w) => normalizeNameKey(w.name) === normalizeNameKey(newWorker.name) && w.id !== newWorker.id
    );
    if (duplicatedByName) {
      if (editingWorker.id) {
        addToast('동일한 작업자명이 이미 존재합니다. 이름을 확인해주세요.', 'error');
        return;
      }

      const mergedWorker = { ...duplicatedByName, daily: newWorker.daily };
      setData((prev) => ({
        ...prev,
        workers: prev.workers.map((w) => (w.id === duplicatedByName.id ? mergedWorker : w)),
      }));
      addToast('동일 작업자로 병합하여 업데이트했습니다.', 'info');
      setIsWorkerModalOpen(false);setEditingWorker(null);
      return;
    }

    if (data.workers.find((w) => w.id === newWorker.id)) {
      setData((prev) => ({ ...prev, workers: prev.workers.map((w) => w.id === newWorker.id ? newWorker : w) }));
      addToast('작업자 정보가 수정되었습니다.', 'success');
    } else {
      setData((prev) => ({ ...prev, workers: [...prev.workers, newWorker] }));
      addToast('새 작업자가 추가되었습니다.', 'success');
    }
    setIsWorkerModalOpen(false);setEditingWorker(null);
  };

  const handleDeleteWorker = (id: string) => {
    if (confirm('작업자를 삭제하시겠습니까?')) {
      setData((prev) => ({ ...prev, workers: prev.workers.filter((w) => w.id !== id) }));
      addToast('작업자가 삭제되었습니다.', 'info');
      setIsWorkerModalOpen(false);
    }
  };

  const getSiteStatusLabel = (status: SiteStatus) => status === 'active' ? '진행중' : status === 'completed' ? '완료' : '예정';
  const getSiteStatusColor = (status: SiteStatus) => status === 'active' ? 'primary' : status === 'completed' ? 'dark' : 'warning';

  const renderTabButton = (tab: 'sites' | 'workers', label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 rounded-2xl transition-all text-sm md:text-xs font-black tracking-tight px-4 py-2 flex items-center justify-center gap-2 ${
        activeTab === tab
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="whitespace-nowrap font-extrabold text-base md:text-base">{label}</span>
    </button>
  );

  return (
    <div className="pb-24 animate-fade-in">
      <div className="flex w-full rounded-2xl bg-muted/80 border border-border/60 p-0.5 shadow-inner gap-0.5 mb-6">
        {renderTabButton('sites', '현장 관리', <Building2 size={14} className="shrink-0" />)}
        {renderTabButton('workers', '작업자 관리', <Users size={14} className="shrink-0" />)}
        {renderTabButton('customers', '거래처 관리', <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase shrink-0"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>)}
      </div>

      <AppCard>
        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex-1 min-w-0">
            {activeTab === 'sites' ? (
              <SearchableSelect
                value={siteSearch}
                onChange={setSiteSearch}
                options={[
                  { id: '', label: '전체 현장' },
                  ...data.sites.map(site => ({
                    id: site.id,
                    label: `${site.name}${site.company_name ? ` (${site.company_name})` : ''}`
                  }))
                ]}
                placeholder="현장명 또는 거래처 검색..."
              />
            ) : activeTab === 'customers' ? (
              <SearchableSelect
                value={customerSearch}
                onChange={setCustomerSearch}
                options={[
                  { id: '', label: '전체 거래처' },
                  ...customers.map(customer => ({
                    id: customer.id,
                    label: `${customer.name}${customer.contact ? ` (${customer.contact})` : ''}`
                  }))
                ]}
                placeholder="거래처명 또는 연락처 검색..."
              />
            ) : (
              <SearchableSelect
                value={workerSearch}
                onChange={setWorkerSearch}
                options={[
                  { id: '', label: '전체 작업자' },
                  ...data.workers.map(worker => ({
                    id: worker.id,
                    label: `${worker.name} (일당: ${formatCurrency(worker.daily)})`
                  }))
                ]}
                placeholder="작업자명 검색..."
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeTab === 'sites' && (
              <>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  ref={siteExcelInputRef}
                  onChange={handleSiteFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => siteExcelInputRef.current?.click()}
                  title="현장 파일 업로드 (엑셀/CSV)"
                  className="bg-muted text-foreground p-2 rounded-xl border border-border hover:scale-105 transition-transform flex items-center justify-center"
                >
                  <FileUp size={18} />
                </button>
              </>
            )}
            <button onClick={activeTab === 'sites' ? openCreateSiteModal : activeTab === 'customers' ? openCreateCustomerModal : openCreateWorkerModal} className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-neon hover:scale-105 transition-transform flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'sites' && (
          <>
            {/* Status filter chips */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {([['all', '전체'], ['active', '진행중'], ['completed', '완료'], ['scheduled', '예정']] as [SiteStatus | 'all', string][]).map(([status, label]) => (
                <button key={status} onClick={() => setSiteStatusFilter(status)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${siteStatusFilter === status ? 'bg-primary text-primary-foreground shadow-neon' : 'bg-card border border-border text-muted-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {/* PC 테이블 뷰 */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-semibold text-foreground">현장명</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">거래처</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">상태</th>
                    <th className="text-right p-3 text-sm font-semibold text-foreground">예산</th>
                    <th className="text-center p-3 text-sm font-semibold text-foreground">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((s) => (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => openEditSiteModal(s)}>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{s.name}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">{s.company_name || '거래처 미입력'}</div>
                      </td>
                      <td className="p-3">
                        <AppBadge type={getSiteStatusColor(s.status) as any}>{getSiteStatusLabel(s.status)}</AppBadge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold text-foreground">{formatCurrency(s.budget)}</div>
                      </td>
                      <td className="p-3 text-center">
                        <button className="p-2 text-muted-foreground hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); openEditSiteModal(s); }}>
                          <Edit2 size={16} className="icon-fixed icon-stroke-normal" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 */}
              <div className="mobile-table-card md:hidden">
                {filteredSites.map((s) =>
                <div key={s.id} onClick={() => openEditSiteModal(s)} className="relative flex items-center justify-between p-4 bg-muted rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group my-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AppBadge type={getSiteStatusColor(s.status) as any}>{getSiteStatusLabel(s.status)}</AppBadge>
                        <span className="text-[10px] text-muted-foreground font-bold">{s.company_name || '거래처 미입력'}</span>
                      </div>
                      <div className="font-bold text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-bold">예산: {formatCurrency(s.budget)}</div>
                    </div>
                    <div className="p-2 text-muted-foreground/50 group-hover:text-primary transition-colors"><Edit2 size={16} /></div>
                  </div>
                )}
              </div>

              {filteredSites.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {siteSearch || siteStatusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 현장이 없습니다.'}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'workers' && (
          <>
            <div className="space-y-3">
              {/* PC 테이블 뷰 */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-semibold text-foreground">작업자명</th>
                    <th className="text-right p-3 text-sm font-semibold text-foreground">일당</th>
                    <th className="text-center p-3 text-sm font-semibold text-foreground">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => (
                    <tr key={w.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => openEditWorkerModal(w)}>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{w.name}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold text-foreground">{formatCurrency(w.daily)}</div>
                      </td>
                      <td className="p-3 text-center">
                        <button className="p-2 text-muted-foreground hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); openEditWorkerModal(w); }}>
                          <Edit2 size={16} className="icon-fixed icon-stroke-normal" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 */}
              <div className="mobile-table-card md:hidden">
                {filteredWorkers.map((w) =>
                <div key={w.id} onClick={() => openEditWorkerModal(w)} className="flex items-center justify-between p-4 bg-muted rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group my-2">
                    <div>
                      <div className="font-bold text-foreground">{w.name}</div>
                      <div className="text-xs text-muted-foreground">일당: {formatCurrency(w.daily)}</div>
                    </div>
                    <div className="p-2 text-muted-foreground/50 group-hover:text-primary transition-colors"><Edit2 size={16} /></div>
                  </div>
                )}
              </div>

              {filteredWorkers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {workerSearch ? '검색 결과가 없습니다.' : '등록된 작업자가 없습니다.'}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <div className="space-y-3">
              {/* PC 테이블 뷰 */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-semibold text-foreground">거래처명</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">연락처</th>
                    <th className="text-center p-3 text-sm font-semibold text-foreground">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => openEditCustomerModal(customer)}>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{customer.name}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">{customer.contact || '-'}</div>
                      </td>
                      <td className="p-3 text-center">
                        <button className="p-2 text-muted-foreground hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); openEditCustomerModal(customer); }}>
                          <Edit2 size={16} className="icon-fixed icon-stroke-normal" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 모바일 카드 뷰 */}
              <div className="mobile-table-card md:hidden">
                {filteredCustomers.map((customer) =>
                  <div key={customer.id} onClick={() => openEditCustomerModal(customer)} className="flex items-center justify-between p-4 bg-muted rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group my-2">
                    <div>
                      <div className="font-bold text-foreground">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">{customer.contact || '연락처 정보 없음'}</div>
                    </div>
                    <div className="p-2 text-muted-foreground/50 group-hover:text-primary transition-colors"><Edit2 size={16} /></div>
                  </div>
                )}
              </div>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {customerSearch ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
                </div>
              )}
            </div>
          </>
        )}
      </AppCard>

      {/* Site Modal */}
      {isSiteModalOpen && editingSite &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">{editingSite.id ? '현장 정보 수정' : '새 현장 추가'}</h3>
              <button onClick={() => setIsSiteModalOpen(false)} className="p-2 bg-muted rounded-full text-muted-foreground icon-wrapper">
                <X size={16} className="icon-fixed icon-stroke-normal" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">현장명</label>
                <input type="text" placeholder="현장 이름 입력" value={editingSite.name} onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })} className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-bold text-foreground outline-none min-h-[44px]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">거래처명 (건설사)</label>
                <input type="text" placeholder="거래처 이름 입력" value={editingSite.company_name || ''} onChange={(e) => setEditingSite({ ...editingSite, company_name: e.target.value })} className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-bold text-foreground outline-none min-h-[44px]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">예산 (원)</label>
                <input type="number" placeholder="0" value={editingSite.budget} onChange={(e) => setEditingSite({ ...editingSite, budget: parseInt(e.target.value) || 0 })} className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-black text-right text-foreground outline-none min-h-[44px]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">진행 상태</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['scheduled', 'active', 'completed'] as SiteStatus[]).map((status) =>
                <button key={status} onClick={() => setEditingSite({ ...editingSite, status })} className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${editingSite.status === status ? status === 'completed' ? 'bg-foreground dark:bg-[#14B8B0] text-background dark:text-white' : status === 'active' ? 'bg-accent border-primary text-accent-foreground' : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-600 dark:text-yellow-400' : 'border-border text-muted-foreground'}`}>
                      {getSiteStatusLabel(status)}
                    </button>
                )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {editingSite.id && <button onClick={() => handleDeleteSite(editingSite.id)} className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-bold icon-wrapper">
                <Trash2 size={20} className="icon-lg icon-stroke-normal icon-lg-mobile-sm" />
              </button>}
                <button onClick={handleSaveSite} className="flex-1 py-4 bg-foreground dark:bg-[#14B8B0] text-background dark:text-white rounded-xl font-bold text-sm shadow-xl">{editingSite.id ? '수정사항 저장' : '새 항목 등록'}</button>
              </div>
            </div>
          </div>
        </div>
      }

      {/* Customer Modal */}
      {isCustomerModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">{editingCustomer.id ? '거래처 정보 수정' : '새 거래처 추가'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 bg-muted rounded-full text-muted-foreground icon-wrapper">
                <X size={16} className="icon-fixed icon-stroke-normal" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">거래처명 *</label>
                <input 
                  type="text" 
                  placeholder="거래처 이름 입력" 
                  value={editingCustomer.name} 
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} 
                  className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-bold text-foreground outline-none min-h-[44px]" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">연락처</label>
                <input 
                  type="text" 
                  placeholder="연락처 입력" 
                  value={editingCustomer.contact || ''} 
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, contact: e.target.value })} 
                  className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-bold text-foreground outline-none min-h-[44px]" 
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button 
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="flex-1 bg-muted text-foreground p-3 rounded-xl border border-border font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={saveCustomer}
                  className="flex-1 bg-primary text-primary-foreground p-3 rounded-xl font-bold shadow-lg shadow-neon hover:scale-105 transition-transform"
                >
                  {editingCustomer.id ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Worker Modal */}
      {isWorkerModalOpen && editingWorker &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">{editingWorker.id ? '작업자 정보 수정' : '새 작업자 추가'}</h3>
              <button onClick={() => setIsWorkerModalOpen(false)} className="p-2 bg-muted rounded-full text-muted-foreground icon-wrapper">
                <X size={16} className="icon-fixed icon-stroke-normal" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">이름</label>
                <input type="text" placeholder="이름 입력" value={editingWorker.name} onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })} className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-bold text-foreground outline-none min-h-[44px]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">일당 (원)</label>
                <input type="number" placeholder="0" value={editingWorker.daily} onChange={(e) => setEditingWorker({ ...editingWorker, daily: parseInt(e.target.value) || 0 })} className="w-full p-3 md:p-3 rounded-xl bg-muted border border-border text-base md:text-sm font-black text-right text-foreground outline-none min-h-[44px]" />
              </div>
              <div className="flex gap-2 pt-2">
                {editingWorker.id && <button onClick={() => handleDeleteWorker(editingWorker.id)} className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-bold icon-wrapper">
                <Trash2 size={20} className="icon-lg icon-stroke-normal icon-lg-mobile-sm" />
              </button>}
                <button onClick={handleSaveWorker} className="flex-1 py-4 bg-foreground dark:bg-[#14B8B0] text-background dark:text-white rounded-xl font-bold text-sm shadow-xl">{editingWorker.id ? '수정사항 저장' : '새 작업자 등록'}</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default AdminView;
