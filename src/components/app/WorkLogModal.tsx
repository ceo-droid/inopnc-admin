import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Edit2, Save, Trash2 } from 'lucide-react';
import type { AppState, WorkLog } from '@/types';
import { formatCurrency, calcPayroll, formatMd, normalizeText, parseISODateLocal } from '@/lib/helpers';
import SearchableSelect from './SearchableSelect';

interface WorkLogModalProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  isLogModalOpen: boolean;
  setLogModalOpen: (open: boolean) => void;
  logModalDate: string;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const WorkLogModal = ({ data, setData, addToast, isLogModalOpen, setLogModalOpen, logModalDate, recentSiteIds, recentWorkerIds }: WorkLogModalProps) => {
  const [targetSiteId, setTargetSiteId] = useState('');
  const [targetWorkerId, setTargetWorkerId] = useState('');
  const [targetMd, setTargetMd] = useState(1.0);
  const [targetMemo, setTargetMemo] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const sitesById = useMemo(() => Object.fromEntries(data.sites.map((site) => [site.id, site] as const)), [data.sites]);
  const todaysLogs = useMemo(() => data.workLogs.filter(l => l.date === logModalDate), [data.workLogs, logModalDate]);
  const selectedWorker = useMemo(() => data.workers.find(w => w.id === targetWorkerId), [data.workers, targetWorkerId]);
  const formattedLogModalDate = useMemo(() => {
    const date = parseISODateLocal(logModalDate);
    if (!date) return logModalDate;
    const yy = String(date.getFullYear()).slice(-2);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${yy}년${month}월${day}일(${weekday})`;
  }, [logModalDate]);

  const isHolidaySiteId = (siteId: string) => {
    const siteNameKey = normalizeText(sitesById[siteId]?.name || '').toLowerCase().replace(/\s+/g, '');
    return siteNameKey.includes('휴무');
  };

  const getEffectiveMd = (siteId: string, md: number) => (isHolidaySiteId(siteId) ? 0 : md);
  const isHolidaySiteSelected = isHolidaySiteId(targetSiteId);
  const effectiveTargetMd = getEffectiveMd(targetSiteId, targetMd);
  const previewPayroll = useMemo(
    () => calcPayroll(selectedWorker?.daily || 0, effectiveTargetMd),
    [selectedWorker?.daily, effectiveTargetMd]
  );
  const buildLogKey = (date: string, workerId: string, siteId: string, md: number) => `${date}|${workerId}|${siteId}|${md}`;

  useEffect(() => { if (isLogModalOpen) resetInputs(); }, [isLogModalOpen]);
  useEffect(() => {
    if (isHolidaySiteSelected && targetMd !== 0) {
      setTargetMd(0);
    }
  }, [isHolidaySiteSelected, targetMd]);

  if (!isLogModalOpen) return null;

  const resetInputs = () => { setTargetSiteId(''); setTargetWorkerId(''); setTargetMd(1.0); setTargetMemo(''); setEditingLogId(null); };

  const handleAdd = () => {
    if (!targetSiteId) return alert('현장을 선택해주세요.');
    if (!targetWorkerId) return alert('작업자를 선택해주세요.');
    const nextMd = getEffectiveMd(targetSiteId, targetMd);
    const newKey = buildLogKey(logModalDate, targetWorkerId, targetSiteId, nextMd);
    const duplicate = data.workLogs.some(
      (l) => buildLogKey(l.date, l.worker_id, l.site_id, getEffectiveMd(l.site_id, l.md)) === newKey
    );
    if (duplicate) {
      addToast('이미 공수 내역이 존재합니다.', 'info');
      return;
    }
    const newLog: WorkLog = {
      id: crypto.randomUUID(),
      date: logModalDate,
      site_id: targetSiteId,
      worker_id: targetWorkerId,
      md: nextMd,
      note: targetMemo.trim(),
    };
    setData(prev => ({ ...prev, workLogs: [...prev.workLogs, newLog] }));
    addToast('공수가 등록되었습니다.', 'success');
  };

  const handleEdit = (log: WorkLog) => { 
    setTargetSiteId(log.site_id); 
    setTargetWorkerId(log.worker_id); 
    setTargetMd(getEffectiveMd(log.site_id, log.md)); 
    setTargetMemo(log.note || ''); 
    setEditingLogId(log.id);
    
    // Scroll to the edit form for better UX
    setTimeout(() => {
      const editForm = document.querySelector('.worklog-edit-form');
      if (editForm) {
        editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUpdate = () => {
    if (!editingLogId || !targetSiteId || !targetWorkerId) return;
    const nextMd = getEffectiveMd(targetSiteId, targetMd);
    const nextKey = buildLogKey(logModalDate, targetWorkerId, targetSiteId, nextMd);
    const duplicate = data.workLogs.some(
      (l) =>
        l.id !== editingLogId &&
        buildLogKey(l.date, l.worker_id, l.site_id, getEffectiveMd(l.site_id, l.md)) === nextKey
    );
    if (duplicate) {
      addToast('수정 결과가 기존 내역과 중복됩니다.', 'error');
      return;
    }
    setData(prev => ({
      ...prev,
      workLogs: prev.workLogs.map((l) =>
        l.id === editingLogId
          ? { ...l, site_id: targetSiteId, worker_id: targetWorkerId, md: nextMd, note: targetMemo.trim() }
          : l
      ),
    }));
    addToast('공수 내역이 수정되었습니다.', 'success');
    resetInputs();
  };

  const handleDelete = (id: string) => {
    if (confirm('이 공수 내역을 삭제하시겠습니까?')) {
      setData(prev => ({ ...prev, workLogs: prev.workLogs.filter(l => l.id !== id) }));
      addToast('삭제되었습니다.', 'info');
      if (editingLogId === id) resetInputs();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-foreground">공수 등록</h3>
            <p className="text-sm text-muted-foreground font-medium">{formattedLogModalDate}</p>
          </div>
          <button onClick={() => setLogModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <div className="worklog-edit-form space-y-4 transition-all duration-300">
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">현장 선택</label>
              <SearchableSelect
                options={data.sites.map((s) => ({ id: s.id, label: s.name, sub: s.company_name }))}
                value={targetSiteId}
                onChange={setTargetSiteId}
                placeholder="현장 검색..."
                recentIds={recentSiteIds}
              />
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">작업자 선택</label>
              <SearchableSelect options={data.workers.map(w => ({ id: w.id, label: w.name }))} value={targetWorkerId} onChange={setTargetWorkerId} placeholder="작업자 검색..." recentIds={recentWorkerIds} />
            </div>

            {/* 실시간 예상 비용 */}
            <div className="bg-card rounded-xl border border-border p-4 mb-4 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="text-[11.8px] font-medium text-muted-foreground">기본 일당</div>
                <div className="text-xs font-black text-foreground">{selectedWorker ? `${formatCurrency(selectedWorker.daily)}원` : '-'}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-muted rounded-xl p-2 border border-border">
                  <div className="text-[10px] font-bold text-muted-foreground mb-0.5">총급여</div>
                  <div className="text-[11px] font-black text-foreground">{selectedWorker ? formatCurrency(previewPayroll.gross) : '-'}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2 border border-red-100 dark:border-red-900/30">
                  <div className="text-[10px] font-bold text-red-500 dark:text-red-400 mb-0.5">세금(3.3%)</div>
                  <div className="text-[11px] font-black text-red-600 dark:text-red-300">{selectedWorker ? `-${formatCurrency(previewPayroll.tax)}` : '-'}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2 border border-blue-100 dark:border-blue-900/30">
                  <div className="text-[10px] font-bold text-info dark:text-blue-300 mb-0.5">실지급액</div>
                  <div className="text-[11px] font-black text-blue-700 dark:text-blue-200">{selectedWorker ? formatCurrency(previewPayroll.net) : '-'}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">공수 {formatMd(effectiveTargetMd)} 기준 · 세금은 원 단위 절사</div>
            </div>

            <div className="flex gap-4">
              <div className="w-1/3">
                <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">공수</label>
                <div className="flex items-center bg-card rounded-xl border border-border overflow-hidden h-[42px]">
                  <button
                    onClick={() => { if (!isHolidaySiteSelected) setTargetMd(Math.max(0, targetMd - 0.5)); }}
                    disabled={isHolidaySiteSelected}
                    className={`w-10 h-full flex items-center justify-center bg-muted text-muted-foreground font-bold border-r border-border ${isHolidaySiteSelected ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    -
                  </button>
                  <div className="flex-1 text-center font-semibold text-sm">{effectiveTargetMd === 0 ? <span className="text-red-500 font-medium">휴무</span> : effectiveTargetMd}</div>
                  <button
                    onClick={() => { if (!isHolidaySiteSelected) setTargetMd(Math.min(3.5, targetMd + 0.5)); }}
                    disabled={isHolidaySiteSelected}
                    className={`w-10 h-full flex items-center justify-center bg-muted text-muted-foreground font-bold border-l border-border ${isHolidaySiteSelected ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[11.8px] font-medium text-muted-foreground mb-1 block">메모 (선택)</label>
                <input type="text" value={targetMemo} onChange={(e) => setTargetMemo(e.target.value)} placeholder="작업 내용 등" className="w-full h-[42px] px-3 rounded-xl bg-card border border-border text-sm font-semibold text-foreground placeholder:font-medium outline-none focus:border-primary transition-colors" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {editingLogId && (
                <button onClick={resetInputs} className="px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-xs">취소</button>
              )}
              <button
                onClick={editingLogId ? handleUpdate : handleAdd}
                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${editingLogId ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground shadow-neon'}`}
              >
                {editingLogId ? <><Save size={14} /> 수정 저장</> : <><Plus size={14} /> 추가하기</>}
              </button>
            </div>
          </div>

          {/* Log List - Grouped by Site */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 px-1">
            총 현장수 ({new Set(todaysLogs.filter(log => getEffectiveMd(log.site_id, log.md) > 0).map(log => log.site_id)).size}건), 
            등록된 공수({todaysLogs.filter(log => getEffectiveMd(log.site_id, log.md) > 0).reduce((sum, log) => sum + getEffectiveMd(log.site_id, log.md), 0).toFixed(1)})
          </h4>
            <div className="space-y-4">
              {todaysLogs.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">아직 등록된 공수가 없습니다.</div>}
              {Object.entries(
                todaysLogs.reduce((groups, log) => {
                  if (!groups[log.site_id]) groups[log.site_id] = [];
                  groups[log.site_id].push(log);
                  return groups;
                }, {} as Record<string, typeof todaysLogs>)
              ).map(([siteId, siteLogs]) => {
                const site = data.sites.find(s => s.id === siteId);
                return (
                  <div key={siteId} className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Site Header */}
                    <div className="bg-muted px-4 py-2 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-foreground truncate">{site?.name || '삭제된 현장'}</div>
                          {site?.company_name?.trim() && (
                            <div className="text-[10px] text-muted-foreground truncate">{site.company_name}</div>
                          )}
                        </div>
                        <span className="text-[10px] text-current font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {siteLogs.filter(log => getEffectiveMd(log.site_id, log.md) > 0).reduce((sum, log) => sum + getEffectiveMd(log.site_id, log.md), 0).toFixed(1)}공수
                        </span>
                      </div>
                    </div>
                    
                    {/* Site Logs */}
                    <div className="divide-y divide-border">
                      {siteLogs.map(log => {
                        const worker = data.workers.find(w => w.id === log.worker_id);
                        const effectiveMd = getEffectiveMd(log.site_id, log.md);
                        const isEditing = editingLogId === log.id;
                        return (
                          <div key={log.id} className={`p-4 transition-all ${isEditing ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-muted/50'}`}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-extrabold text-foreground">{worker?.name || '미등록'}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${effectiveMd === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : effectiveMd === 0.5 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600'}`}>{effectiveMd === 0 ? '휴무' : `${effectiveMd}공수`}</span>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => handleEdit(log)} 
                                  className="p-2 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                                  title="수정하기"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(log.id)} className="p-2 text-muted-foreground/50 hover:text-destructive transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            {log.note && <div className="text-xs font-medium text-foreground bg-gray-100 dark:bg-gray-800 p-3 rounded-xl break-words mt-2 border border-gray-200 dark:border-gray-700">{log.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkLogModal;
