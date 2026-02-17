import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { Toast } from '@/types';

interface ToastContainerProps {
  toasts: Toast[];
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  return (
    <div className="fixed top-14 md:top-6 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="bg-foreground text-background px-3 py-2 rounded-xl shadow-lg flex items-center text-xs font-semibold animate-slide-in-top">
          {toast.type === 'success' && <CheckCircle size={13} className="mr-1.5 text-green-400 shrink-0" />}
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
