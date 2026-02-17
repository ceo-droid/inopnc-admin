import React from 'react';
import { Bell, Sun, Moon, RefreshCw } from 'lucide-react';
import type { TabId } from '@/constants/navigation';

interface MobileHeaderProps {
  setActiveTab: (tab: TabId) => void;
  darkMode: boolean;
  toggleTheme: () => void;
  onClearCache: () => void;
  onNotificationClick: () => void;
  hasNotifications: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  setActiveTab,
  darkMode,
  toggleTheme,
  onClearCache,
  onNotificationClick,
  hasNotifications
}) => {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-4 flex justify-between items-center border-b border-border">
      <span onClick={() => setActiveTab('home')} className="logo-mobile text-foreground tracking-tighter cursor-pointer font-extrabold text-[22px]">금전출납</span>
      <div className="flex items-center gap-3">
        <button 
          onClick={onClearCache} 
          className="p-kakao-xs bg-card rounded-kakao shadow-soft text-muted-foreground hover:shadow-card transition-all duration-200" 
          title="캐시 정리"
        >
          <RefreshCw size={18} />
        </button>
        <button 
          onClick={toggleTheme} 
          className="p-kakao-xs bg-card rounded-kakao shadow-soft text-foreground hover:shadow-card transition-all duration-200"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button 
          onClick={onNotificationClick} 
          className="p-kakao-xs bg-card rounded-kakao shadow-soft text-foreground hover:shadow-card transition-all duration-200 relative"
        >
          <Bell size={18} />
          {hasNotifications && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-card"></span>}
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
