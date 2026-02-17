import React from 'react';
import { Bell, Sun, Moon, RefreshCw } from 'lucide-react';
import { navItems, type TabId } from '@/constants/navigation';

interface DesktopSidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  darkMode: boolean;
  toggleTheme: () => void;
  onClearCache: () => void;
  onNotificationClick: () => void;
  hasNotifications: boolean;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  darkMode,
  toggleTheme,
  onClearCache,
  onNotificationClick,
  hasNotifications
}) => {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex-col p-6 z-50">
      <div className="flex items-center gap-3 mb-kakao-xl">
        <span onClick={() => setActiveTab('home')} className="logo-desktop text-foreground tracking-tighter cursor-pointer">INOPNC</span>
      </div>
      <nav className="space-y-2 flex-1">
        {navItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveTab(item.id as TabId)}
            className={`w-full flex items-center gap-3 px-kakao h-[48px] rounded-kakao text-body font-extrabold transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-neon' 
                : 'text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:shadow-soft'
            }`}
          >
            <item.icon size={20} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-border space-y-3">
        <button 
          onClick={onNotificationClick} 
          className="w-full flex items-center gap-3 px-kakao py-kakao-xs rounded-kakao text-body font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 relative"
        >
          <Bell size={18} /> 알림
          {hasNotifications && <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>}
        </button>
        <div className="flex items-center gap-2 px-4">
          <button 
            onClick={toggleTheme} 
            className="flex items-center gap-3 text-body font-semibold text-muted-foreground hover:text-primary transition-all duration-200"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />} {darkMode ? '라이트 모드' : '다크 모드'}
          </button>
          <button 
            onClick={onClearCache} 
            className="p-2 text-muted-foreground hover:text-primary transition-colors" 
            title="캐시 정리"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
