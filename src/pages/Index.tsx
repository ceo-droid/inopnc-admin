import React, { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { clearCache } from '@/utils/cache';
import { type TabId } from '@/constants/navigation';
import { toLocalISODate } from '@/lib/helpers';
import HomeView from '@/views/HomeView';
import ExpenseView from '@/views/ExpenseView';
import ChecklistView from '@/views/ChecklistView';
import AdminView from '@/views/AdminView';
import WorkLogModal from '@/components/app/WorkLogModal';
import NotificationModal from '@/components/app/NotificationModal';
import PwaInstallPrompt from '@/components/app/PwaInstallPrompt';
import DesktopSidebar from '@/components/layout/DesktopSidebar';
import MobileHeader from '@/components/layout/MobileHeader';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import ToastContainer from '@/components/layout/ToastContainer';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalISODate());
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const [logModalDate, setLogModalDate] = useState<string>(() => toLocalISODate());
  const [isNotifModalOpen, setNotifModalOpen] = useState(false);
  const [focusChecklistItemId, setFocusChecklistItemId] = useState<string | null>(null);

  const { darkMode, toggleTheme } = useTheme();
  const { toasts, addToast } = useToast();
  const { data, setData, loading, reload } = useSupabaseData(addToast);

  const handleClearCache = async () => {
    try {
      await clearCache();
      await reload();
      addToast('캐시를 정리했습니다', 'success');
    } catch {
      addToast('캐시 정리 실패', 'error');
    }
  };

  const recentSiteIds = useMemo(() => Array.from(new Set(data.workLogs.map((l) => l.site_id))).slice(0, 5), [data.workLogs]);
  const recentWorkerIds = useMemo(() => Array.from(new Set(data.workLogs.map((l) => l.worker_id))).slice(0, 5), [data.workLogs]);

  const hasNotifications = data.checklists.some((i) => i.status !== 'completed');

  const handleNavigateToChecklistItem = (id: string) => {
    setActiveTab('checklist');
    setFocusChecklistItemId(id);
    setNotifModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors md:pl-64 safe-area-pb handset-landscape-shell">
      <DesktopSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        onClearCache={handleClearCache}
        onNotificationClick={() => setNotifModalOpen(true)}
        hasNotifications={hasNotifications}
      />

      <MobileHeader
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        onClearCache={handleClearCache}
        onNotificationClick={() => setNotifModalOpen(true)}
        hasNotifications={hasNotifications}
      />

      <main className="p-kakao md:p-kakao-xl max-w-7xl mx-auto min-h-screen handset-landscape-main">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
            {activeTab === 'home' && <HomeView data={data} setData={setData} addToast={addToast} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setLogModalOpen={setLogModalOpen} setLogModalDate={setLogModalDate} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />}
            {activeTab === 'expenses' && <ExpenseView data={data} setData={setData} addToast={addToast} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />}
            {activeTab === 'checklist' && (
              <ChecklistView
                data={data}
                setData={setData}
                addToast={addToast}
                focusItemId={focusChecklistItemId}
                onFocusItemHandled={() => setFocusChecklistItemId(null)}
              />
            )}
            {activeTab === 'admin' && <AdminView data={data} setData={setData} addToast={addToast} />}
          </>
        )}
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <WorkLogModal data={data} setData={setData} addToast={addToast} isLogModalOpen={isLogModalOpen} setLogModalOpen={setLogModalOpen} logModalDate={logModalDate} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />
      <NotificationModal
        isOpen={isNotifModalOpen}
        onClose={() => setNotifModalOpen(false)}
        checklists={data.checklists}
        setData={setData}
        addToast={addToast}
        onItemNavigate={handleNavigateToChecklistItem}
      />
      <PwaInstallPrompt />

      <ToastContainer toasts={toasts} />
    </div>
  );

};

export default Index;
