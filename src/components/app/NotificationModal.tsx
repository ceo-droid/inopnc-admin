import React from 'react';
import { X, CheckCircle, Circle } from 'lucide-react';
import type { ChecklistItem, AppState } from '@/types';
import { formatCurrency } from '@/lib/helpers';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklists: ChecklistItem[];
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const NotificationModal = ({ isOpen, onClose, checklists, setData, addToast }: NotificationModalProps) => {
  if (!isOpen) return null;
  
  const sortedItems = [...checklists].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return b.date.localeCompare(a.date);
  });

  const toggleStatus = (id: string) => {
    setData(prev => ({
      ...prev,
      checklists: prev.checklists.map(c => 
        c.id === id ? { ...c, status: c.status === 'completed' ? 'pending' : 'completed' } : c
      ),
    }));
    addToast('상태가 변경되었습니다.', 'success');
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'receivable': return '받을돈';
      case 'payable': return '줄돈';
      case 'task': return '업무';
      case 'material': return '자재';
      default: return '기타';
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'receivable': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'payable': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'task': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
      case 'material': return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
          <h3 className="text-xl font-bold text-foreground">체크리스트 알림</h3>
          <button onClick={onClose} className="p-2 bg-muted rounded-full text-muted-foreground icon-wrapper">
            <X size={16} className="icon-fixed icon-stroke-normal" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {sortedItems.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">등록된 항목이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map(item => (
                <div key={item.id} className={`p-4 rounded-2xl border transition-all ${item.status === 'completed' ? 'bg-muted/50 border-border/50 opacity-75' : 'bg-muted border-border'}`}>
                  <div className="flex items-start gap-3">
                    <button 
                      onClick={() => toggleStatus(item.id)}
                      className="mt-0.5 text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                    >
                      {item.status === 'completed' ? <CheckCircle size={20} /> : <Circle size={20} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      {/* Header: Type and Date */}
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{item.date}</span>
                      </div>
                      
                      {/* Title and Amount in one row */}
                      <div className="flex justify-between items-center mb-2">
                        <div className={`font-bold text-sm flex-1 ${item.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.title}
                        </div>
                        {item.amount > 0 && (
                          <div className={`font-black text-sm flex-shrink-0 ml-2 ${item.status === 'completed' ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {formatCurrency(item.amount)}원
                          </div>
                        )}
                      </div>
                      
                      {/* Supplier Info */}
                      {item.supplier && (
                        <div className="text-xs text-muted-foreground">
                          거래처: {item.supplier} {item.quantity && `| 수량: ${item.quantity.toLocaleString()}개`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border bg-muted">
          <button onClick={onClose} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-neon">확인</button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
