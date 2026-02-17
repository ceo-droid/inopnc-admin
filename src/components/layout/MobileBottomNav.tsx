import React from 'react';
import { navItems, type TabId } from '@/constants/navigation';

interface MobileBottomNavProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 flex justify-between items-center z-40 safe-area-pb my-0 pt-4 pb-4">
      {navItems.map((item) => (
        <button 
          key={item.id} 
          onClick={() => setActiveTab(item.id as TabId)} 
          className={`flex flex-col items-center gap-1 ${
            activeTab === item.id ? 'text-primary' : 'text-muted-foreground hover:text-primary'
          }`}
        >
          <item.mobileIcon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-micro-md font-semibold">{item.mobileLabel}</span>
        </button>
      ))}
    </nav>
  );
};

export default MobileBottomNav;
