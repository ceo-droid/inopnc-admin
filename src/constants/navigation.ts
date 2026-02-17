import { LayoutDashboard, Wallet, CheckSquare, Users, Calendar } from 'lucide-react';

export const navItems = [
  { id: 'home', icon: LayoutDashboard, label: '작업 캘린더', mobileIcon: Calendar, mobileLabel: '달력' },
  { id: 'expenses', icon: Wallet, label: '수익/경비', mobileIcon: Wallet, mobileLabel: '수익' },
  { id: 'checklist', icon: CheckSquare, label: '자금/업무', mobileIcon: CheckSquare, mobileLabel: '업무' },
  { id: 'admin', icon: Users, label: '관리자 설정', mobileIcon: Users, mobileLabel: '관리' }
];

export type TabId = 'home' | 'expenses' | 'checklist' | 'admin';
