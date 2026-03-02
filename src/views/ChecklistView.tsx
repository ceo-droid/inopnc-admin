import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { AppState, ChecklistItem, ChecklistType } from '@/types';
import {
  canonicalizeCompanyName,
  findSimilarCompanyName,
  isSpecialCompanyName,
  normalizeCompanyName,
} from '@/lib/companyName';
import { formatCurrency, toLocalISODate } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';
import SearchableSelect from '@/components/app/SearchableSelect';

interface ChecklistViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  focusItemId?: string | null;
  onFocusItemHandled?: () => void;
}

const ChecklistView = ({ data, setData, addToast, focusItemId, onFocusItemHandled }: ChecklistViewProps) => {
  const [newItemType, setNewItemType] = useState<ChecklistType>('task');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('38000');
  const [newItemDate, setNewItemDate] = useState(() => toLocalISODate());
  const [filterType, setFilterType] = useState<ChecklistType | 'all'>('all');
  
  // 자재 관리 상태
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemShippingType, setNewItemShippingType] = useState<'prepaid' | 'postpaid' | 'delivery'>('prepaid');
  const [newItemPaymentStatus, setNewItemPaymentStatus] = useState<'requested' | 'not_requested' | 'received' | 'not_received'>('not_requested');
  
  // 항목 필드 상태 (받을돈, 줄돈, 업무용)
  const [newItemContent, setNewItemContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusTimerRef = useRef<number | null>(null);
  
  const MATERIAL_UNIT_PRICE = parseInt(newItemUnitPrice.replace(/,/g, '')) || 38000; // 자재 단가

  const sortedChecklists = [...data.checklists]
    .filter(c => filterType === 'all' || c.type === filterType)
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return b.date.localeCompare(a.date);
    });

  useEffect(() => {
    if (!focusItemId) return;
    setFilterType('all');

    const hasTarget = data.checklists.some((item) => item.id === focusItemId);
    if (!hasTarget) {
      onFocusItemHandled?.();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = itemRefs.current[focusItemId];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusedItemId(focusItemId);

        if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = window.setTimeout(() => {
          setFocusedItemId((prev) => (prev === focusItemId ? null : prev));
        }, 2200);
      }

      onFocusItemHandled?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data.checklists, focusItemId, onFocusItemHandled]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

  const supplierOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; label: string }[] = [];

    const addOption = (raw: string | undefined) => {
      const label = String(raw || '').trim();
      if (!label) return;
      const key = label.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ id: label, label });
    };

    data.customers.forEach((customer) => addOption(canonicalizeCompanyName(customer.name)));
    data.sites.forEach((site) => addOption(canonicalizeCompanyName(site.company_name || '')));
    addOption(canonicalizeCompanyName(newItemSupplier));
    addOption(canonicalizeCompanyName(newItemTitle));

    return options;
  }, [data.customers, data.sites, newItemSupplier, newItemTitle]);

  useEffect(() => {
    setData((prev) => {
      let changed = false;
      let specialIndex = -1;
      const customers = prev.customers.reduce<typeof prev.customers>((acc, customer) => {
        if (!isSpecialCompanyName(customer.name)) {
          acc.push(customer);
          return acc;
        }

        const canonical = canonicalizeCompanyName(customer.name);
        if (specialIndex === -1) {
          specialIndex = acc.length;
          if (canonical !== String(customer.name || '').trim()) changed = true;
          acc.push({ ...customer, name: canonical });
          return acc;
        }

        changed = true;
        const existing = acc[specialIndex];
        const hasContact = String(existing.contact || '').trim();
        const nextContact = String(customer.contact || '').trim();
        if (!hasContact && nextContact) {
          acc[specialIndex] = { ...existing, contact: nextContact };
        }
        return acc;
      }, []);

      const sites = prev.sites.map((site) => {
        const companyName = String(site.company_name || '').trim();
        if (!companyName) return site;
        const canonical = canonicalizeCompanyName(companyName);
        if (canonical === companyName) return site;
        changed = true;
        return { ...site, company_name: canonical };
      });

      const checklists = prev.checklists.map((item) => {
        const supplier = String(item.supplier || '').trim();
        if (!supplier) return item;
        const canonical = canonicalizeCompanyName(supplier);
        if (canonical === supplier) return item;
        changed = true;
        return { ...item, supplier: canonical };
      });

      if (!changed) return prev;
      return { ...prev, customers, sites, checklists };
    });
  }, [setData]);

  const resolveSupplierDisplay = (supplier?: string) => {
    const raw = String(supplier || '').trim();
    if (!raw) return '';
    const matchedSite = data.sites.find((site) => site.id === raw);
    return canonicalizeCompanyName(matchedSite?.company_name || matchedSite?.name || raw);
  };

  const splitLegacyTitle = (title: string) => {
    const normalizedTitle = String(title || '').trim();
    const [head, ...rest] = normalizedTitle.split(' - ');
    if (rest.length === 0) return { supplier: '', content: normalizedTitle };
    return { supplier: head.trim(), content: rest.join(' - ').trim() };
  };

  const getChecklistCardDisplay = (item: ChecklistItem) => {
    if (item.type === 'material') {
      const supplier = resolveSupplierDisplay(item.supplier);
      const rawTitle = String(item.title || '').trim();
      const titleKey = normalizeCompanyName(rawTitle);
      const supplierKey = normalizeCompanyName(supplier);
      const sameAsSupplier =
        !!titleKey &&
        !!supplierKey &&
        Math.min(titleKey.length, supplierKey.length) >= 3 &&
        (titleKey === supplierKey || titleKey.includes(supplierKey) || supplierKey.includes(titleKey));
      return {
        title: sameAsSupplier ? supplier : rawTitle || supplier,
        supplier,
      };
    }

    const supplierFromField = resolveSupplierDisplay(item.supplier);
    if (supplierFromField) {
      const rawTitle = String(item.title || '').trim();
      const content = rawTitle && rawTitle !== supplierFromField ? rawTitle : '';
      return {
        title: content || supplierFromField,
        supplier: supplierFromField,
      };
    }

    const legacy = splitLegacyTitle(item.title || '');
    if (legacy.supplier) {
      return {
        title: legacy.content || legacy.supplier,
        supplier: legacy.supplier,
      };
    }

    return {
      title: legacy.content || item.title,
      supplier: '',
    };
  };

  const resetForm = () => {
    setNewItemTitle('');
    setNewItemAmount('');
    setNewItemContent('');
    setNewItemSupplier('');
    setNewItemQuantity('');
    setNewItemUnitPrice('38000');
    setNewItemShippingType('prepaid');
    setNewItemPaymentStatus('not_requested');
  };

  const saveItem = () => {
    if (newItemType === 'material') {
      if (!newItemSupplier.trim()) return alert('거래처를 입력해주세요.');
      if (!newItemQuantity.trim()) return alert('수량을 입력해주세요.');
    } else if (!newItemTitle.trim()) {
      return alert('거래처를 입력해주세요.');
    }

    let amount = 0;
    let supplier: string | undefined;
    let quantity: number | undefined;
    let shippingType: 'prepaid' | 'postpaid' | 'delivery' | undefined;
    let paymentStatus: 'requested' | 'not_requested' | 'received' | 'not_received' | undefined;
    let unitPrice: number | undefined;
    const selectedSupplierRawName = (newItemType === 'material' ? newItemSupplier : newItemTitle).trim();
    const canonicalSupplierName = canonicalizeCompanyName(selectedSupplierRawName);
    const duplicateSupplierName = findSimilarCompanyName(
      canonicalSupplierName,
      data.customers.map((customer) => customer.name)
    );
    const selectedSupplierName = duplicateSupplierName || canonicalSupplierName;
    const selectedMaterialName = newItemTitle.trim();
    const content = newItemContent.trim();
    const hasSimilarDuplicate =
      !!canonicalSupplierName &&
      !!duplicateSupplierName &&
      normalizeCompanyName(canonicalSupplierName) !== normalizeCompanyName(duplicateSupplierName);

    if (newItemType === 'material') {
      quantity = parseInt(newItemQuantity.replace(/,/g, ''), 10) || 0;
      unitPrice = MATERIAL_UNIT_PRICE;
      amount = quantity * unitPrice;
      supplier = selectedSupplierName;
      shippingType = newItemShippingType;
      paymentStatus = newItemPaymentStatus;
    } else {
      amount = parseInt(newItemAmount.replace(/,/g, ''), 10) || 0;
      supplier = selectedSupplierName;
    }

    const composedTitle =
      newItemType === 'material'
        ? selectedMaterialName || selectedSupplierName
        : content || selectedSupplierName;

    const draftItem: ChecklistItem = {
      id: editingItemId ?? crypto.randomUUID(),
      type: newItemType,
      date: newItemDate,
      title: composedTitle,
      amount,
      status: 'pending',
      ...(supplier && { supplier }),
      ...(newItemType === 'material' && {
        memo: content,
        quantity,
        unitPrice,
        shippingType,
        paymentStatus,
      }),
    };

    const selectedCustomerName = selectedSupplierName;
    const normalizedSelectedCustomerName = normalizeCompanyName(selectedCustomerName);
    const isEditing = !!editingItemId;

    setData((prev) => {
      const hasCustomer =
        !!normalizedSelectedCustomerName &&
        prev.customers.some(
          (customer) =>
            normalizeCompanyName(canonicalizeCompanyName(customer.name)) === normalizedSelectedCustomerName
        );

      const customers =
        normalizedSelectedCustomerName && !hasCustomer
          ? [...prev.customers, { id: crypto.randomUUID(), name: selectedCustomerName, contact: '' }]
          : prev.customers;

      const checklists = isEditing
        ? prev.checklists.map((item) => {
            if (item.id !== editingItemId) return item;
            return {
              id: item.id,
              type: draftItem.type,
              date: draftItem.date,
              title: draftItem.title,
              amount: draftItem.amount,
              status: item.status,
              memo: draftItem.type === 'material' ? draftItem.memo : item.memo,
              ...(draftItem.supplier && { supplier: draftItem.supplier }),
              ...(draftItem.type === 'material' && {
                quantity: draftItem.quantity,
                unitPrice: draftItem.unitPrice,
                shippingType: draftItem.shippingType,
                paymentStatus: draftItem.paymentStatus,
              }),
            };
          })
        : [...prev.checklists, draftItem];

      return {
        ...prev,
        customers,
        checklists,
      };
    });

    if (hasSimilarDuplicate) {
      addToast('유사 거래처명이 있어 기존 거래처명으로 저장했습니다.', 'info');
    }
    if (isEditing) setEditingItemId(null);
    resetForm();
    addToast(isEditing ? '항목이 수정되었습니다.' : '항목이 등록되었습니다.', 'success');
  };

  const startEditItem = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setNewItemType(item.type);
    setNewItemDate(item.date);

    if (item.type === 'material') {
      const supplierFromField = resolveSupplierDisplay(item.supplier || item.title || '');
      const normalizedTitle = String(item.title || '').trim();
      const sameAsSupplier =
        !!supplierFromField &&
        !!normalizedTitle &&
        Math.min(normalizeCompanyName(supplierFromField).length, normalizeCompanyName(normalizedTitle).length) >= 3 &&
        (normalizeCompanyName(supplierFromField) === normalizeCompanyName(normalizedTitle) ||
          normalizeCompanyName(supplierFromField).includes(normalizeCompanyName(normalizedTitle)) ||
          normalizeCompanyName(normalizedTitle).includes(normalizeCompanyName(supplierFromField)));
      setNewItemSupplier(supplierFromField);
      setNewItemQuantity(item.quantity ? String(item.quantity) : '');
      setNewItemUnitPrice(item.unitPrice ? String(item.unitPrice) : '38000');
      setNewItemShippingType(item.shippingType || 'prepaid');
      setNewItemPaymentStatus(item.paymentStatus || 'not_requested');
      setNewItemTitle(sameAsSupplier ? '' : normalizedTitle);
      setNewItemContent(item.memo || '');
      setNewItemAmount('');
    } else {
      const supplierFromField = resolveSupplierDisplay(item.supplier);
      if (supplierFromField) {
        setNewItemTitle(supplierFromField);
        const normalizedTitle = String(item.title || '').trim();
        setNewItemContent(normalizedTitle && normalizedTitle !== supplierFromField ? normalizedTitle : '');
      } else {
        const legacy = splitLegacyTitle(item.title || '');
        if (legacy.supplier) {
          setNewItemTitle(legacy.supplier);
          setNewItemContent(legacy.content);
        } else {
          setNewItemTitle(legacy.content);
          setNewItemContent('');
        }
      }
      setNewItemAmount(item.amount ? String(item.amount) : '');
      setNewItemSupplier('');
      setNewItemQuantity('');
      setNewItemUnitPrice('38000');
      setNewItemShippingType('prepaid');
      setNewItemPaymentStatus('not_requested');
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    resetForm();
  };

  const toggleStatus = (id: string) => {
    setData(prev => ({
      ...prev,
      checklists: prev.checklists.map(c => c.id === id ? { ...c, status: c.status === 'completed' ? 'pending' : 'completed' } : c),
    }));
  };

  const deleteItem = (id: string) => {
    if (confirm('삭제하시겠습니까?')) {
      setData(prev => ({ ...prev, checklists: prev.checklists.filter(c => c.id !== id) }));
      if (editingItemId === id) cancelEdit();
      addToast('삭제되었습니다.', 'info');
    }
  };

  const getTypeColor = (type: ChecklistType) => {
    if (type === 'receivable') return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    if (type === 'payable') return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    if (type === 'material') return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  };

  return (
    <div className="pb-24 animate-fade-in max-w-4xl mx-auto">

      <h3 className="font-extrabold text-[22px] mb-4 flex items-center gap-2"> 새 항목 등록</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AppCard className="md:col-span-1 h-fit">
          <div className="space-y-4">
            <div>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { id: 'receivable' as const, label: '받을돈' },
                  { id: 'payable' as const, label: '줄돈' },
                  { id: 'task' as const, label: '업무' },
                  { id: 'material' as const, label: '자재' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setNewItemType(t.id)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center ${newItemType === t.id ? 'bg-primary text-primary-foreground shadow-neon' : 'bg-card border border-border text-muted-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">날짜</label>
              <input type="date" value={newItemDate} onChange={e => setNewItemDate(e.target.value)} className="w-full p-2.5 md:p-2.5 rounded-xl bg-muted border border-border text-base md:text-xs font-bold text-foreground outline-none min-h-[44px]" />
            </div>
            <div>
              <label className="block text-[11.8px] font-medium text-muted-foreground mb-1">
                거래처
              </label>
              {newItemType === 'material' ? (
                <SearchableSelect
                  value={newItemSupplier}
                  onChange={(value) => {
                    setNewItemSupplier(value);
                    // 자재 탭에서는 title을 빈 문자열로 유지
                    setNewItemTitle('');
                  }}
                  options={supplierOptions}
                  allowCustomValue
                  placeholder="거래처 선택 또는 입력"
                />
              ) : (
                <SearchableSelect
                  value={newItemTitle}
                  onChange={(value) => {
                    setNewItemTitle(value);
                    // 자동 설정 제거 - 사용자가 직접 입력하도록 유지
                  }}
                  options={supplierOptions}
                  allowCustomValue
                  placeholder="거래처 선택 또는 입력"
                />
              )}
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">
                {newItemType === 'material' ? '메모' : '항목'}
              </label>
              <input 
                type="text" 
                placeholder={newItemType === 'material' ? '메모 입력' : '항목 입력'}
                value={newItemContent} 
                onChange={e => setNewItemContent(e.target.value)} 
                className="w-full p-2.5 md:p-2.5 rounded-xl bg-muted border border-border text-body text-base md:text-base font-black text-foreground outline-none placeholder:text-muted-foreground min-h-[44px]" 
              />
            </div>
            {newItemType !== 'task' && (
              <div>
                <label className="text-micro-md text-muted-foreground mb-1 block font-bold">
                  {newItemType === 'material' ? '자재' : ''}
                </label>
                {newItemType === 'material' ? (
                  <select 
                    value={newItemTitle} 
                    onChange={e => setNewItemTitle(e.target.value)} 
                    className="w-full p-2.5 md:p-2.5 rounded-xl bg-muted border border-border text-base md:text-xs font-bold text-foreground outline-none appearance-none cursor-pointer pr-8 min-h-[44px]"
                  >
                    <option value="">선택해주세요</option>
                    <option value="NPC-1000">NPC-1000</option>
                    <option value="NPC-3000Q">NPC-3000Q</option>
                    <option value="기타">기타</option>
                  </select>
                ) : null}
              </div>
            )}
            {newItemType !== 'task' && (
              <div>
                <label className="text-micro-md text-muted-foreground mb-1 block font-bold">
                  금액
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={newItemType === 'material' ? '38000' : '0'}
                    value={newItemType === 'material' ? newItemUnitPrice : newItemAmount}
                    onChange={e => {
                      if (newItemType === 'material') {
                        setNewItemUnitPrice(e.target.value);
                      } else {
                        setNewItemAmount(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 md:p-2.5 rounded-xl bg-muted border border-border text-base md:text-sm text-foreground outline-none font-black text-right pr-8 min-h-[44px]"
                  />
                  <span className="absolute right-3 top-2.5 md:top-2.5 text-base md:text-sm font-bold text-muted-foreground">원</span>
                </div>
              </div>
            )}
            
            {newItemType === 'material' && (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-2 mobile-column mobile-stack">
                  <div>
                    <label className="text-micro-md text-muted-foreground mb-1 block font-bold">수량</label>
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={newItemQuantity} 
                      onChange={e => setNewItemQuantity(e.target.value)} 
                      className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none font-black text-right min-h-[44px] md:text-sm text-quantity" 
                    />
                  </div>
                  <div className="mobile-hide md:block">
                    <label className="text-micro-md text-muted-foreground mb-1 block font-bold">단가</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={newItemUnitPrice}
                        onChange={e => setNewItemUnitPrice(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none text-right pr-8 min-h-[44px]" 
                      />
                      <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">원</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground font-bold text-amount">
                  합계: {newItemQuantity ? formatCurrency((parseInt(newItemQuantity) || 0) * MATERIAL_UNIT_PRICE) : '0'}원
                </div>
                
                <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
                  <div>
                    <label className="text-micro-md text-muted-foreground mb-1 block font-bold">운임</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'prepaid', label: '선불' },
                        { value: 'postpaid', label: '착불' },
                        { value: 'delivery', label: '택배' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setNewItemShippingType(option.value as any)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all min-h-[44px] flex items-center justify-center whitespace-nowrap flex-1 ${
                            newItemShippingType === option.value 
                              ? 'bg-transparent border-primary text-primary dark:border-primary dark:text-primary' 
                              : 'border-border text-muted-foreground hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-micro-md text-muted-foreground mb-1 block font-bold">결제</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'not_requested', label: '미청구' },
                        { value: 'requested', label: '청구' },
                        { value: 'not_received', label: '미입금' },
                        { value: 'received', label: '입금' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setNewItemPaymentStatus(option.value as any)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all min-h-[44px] flex items-center justify-center whitespace-nowrap flex-1 ${
                            newItemPaymentStatus === option.value 
                              ? 'bg-transparent border-primary text-primary dark:border-primary dark:text-primary' 
                              : 'border-border text-muted-foreground hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            <button onClick={saveItem} className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground rounded-xl font-bold text-xs shadow-lg shadow-neon transition-all active:scale-95 flex items-center justify-center gap-1">
              <Plus size={14} /> {editingItemId ? '수정 저장' : '등록하기'}
            </button>
            {editingItemId && (
              <button
                onClick={cancelEdit}
                className="w-full py-3 bg-card border border-border text-muted-foreground rounded-xl font-bold text-xs transition-all hover:text-foreground"
              >
                수정 취소
              </button>
            )}
          </div>
        </AppCard>

        <div className="md:col-span-2 space-y-3">
          {sortedChecklists.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs bg-card rounded-2xl">등록된 항목이 없습니다.</div>}
          {sortedChecklists.map(item => {
            const isEditingItem = editingItemId === item.id;
            const isFocusedItem = focusedItemId === item.id;
            const cardDisplay = getChecklistCardDisplay(item);
            return (
            <div
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              className={`flex items-center p-4 bg-card rounded-2xl border transition-all ${
                isEditingItem
                  ? 'border-primary/50 ring-1 ring-primary/30'
                  : isFocusedItem
                    ? 'border-primary/50 ring-1 ring-primary/30 shadow-sm'
                    : item.status === 'completed'
                      ? 'opacity-60 border-border'
                      : 'border-border shadow-sm'
              }`}
            >
              <button onClick={() => toggleStatus(item.id)} className={`!w-6 !h-6 !min-w-6 !min-h-6 !p-0 md:!w-[14px] md:!h-[14px] md:!min-w-[14px] md:!min-h-[14px] rounded-full border-2 flex items-center justify-center mr-2 md:mr-3 transition-colors flex-shrink-0 flex-none self-center ${
  item.status === 'completed' 
    ? 'bg-primary border-primary text-white' 
    : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 hover:border-primary hover:bg-primary/5 dark:hover:border-primary dark:hover:bg-primary/10'
}`}>
  {item.status === 'completed' && (
    <svg className="w-3 h-3 text-white min-w-[12px] min-h-[12px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )}
</button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-micro-md font-bold px-1.5 py-0.5 rounded ${getTypeColor(item.type)}`}>
                    {item.type === 'receivable' ? '미수금' : item.type === 'payable' ? '미지급' : item.type === 'material' ? '자재' : '업무'}
                  </span>
                  <span className="text-micro-md text-muted-foreground">{item.date}</span>
                </div>
                <div className={`font-bold text-sm ${item.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{cardDisplay.title}</div>
                 
                 {/* 자재 항목 추가 정보 */}
                {item.type === 'material' && cardDisplay.supplier && (
                  <div className="text-xs text-muted-foreground mt-1">
                    거래처: {cardDisplay.supplier} | 수량: {item.quantity || 0}개 | 단가: {formatCurrency(item.unitPrice || 0)}원
                  </div>
                )}

                {item.type !== 'material' && cardDisplay.supplier && cardDisplay.title !== cardDisplay.supplier && (
                  <div className="text-xs text-muted-foreground mt-1">
                    거래처: {cardDisplay.supplier}
                  </div>
                )}
                 
                {item.amount > 0 && (
                  <div className={`text-xs font-black mt-1 ${
                    item.type === 'receivable' ? 'text-blue-500' : 
                    item.type === 'payable' ? 'text-red-500' : 
                    item.type === 'material' ? 'text-teal-500' : 
                    'text-gray-500'
                  }`}>
                    {formatCurrency(item.amount)}원
                    {item.type === 'material' && item.shippingType && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        ({item.shippingType === 'prepaid' ? '선불' : item.shippingType === 'postpaid' ? '착불' : '택배'})
                        {item.paymentStatus && (
                          <span className="ml-1 font-normal">
                            • {item.paymentStatus === 'not_requested' ? '미청구' : 
                              item.paymentStatus === 'requested' ? '청구' : 
                              item.paymentStatus === 'not_received' ? '미입금' : '입금'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => startEditItem(item)}
                  className="text-muted-foreground/40 hover:text-foreground p-2"
                  title="수정"
                  aria-label="수정"
                >
                  <Pencil size={16} />
                </button>
                <button onClick={() => deleteItem(item.id)} className="text-muted-foreground/30 hover:text-destructive p-2"><Trash2 size={16} /></button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChecklistView;
