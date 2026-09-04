import type { ExpenseCategory } from '@/constants/expenseCategories';
export type { ExpenseCategory } from '@/constants/expenseCategories';

export interface Transaction {
  id: string;
  date: string;
  site_id: string;
  worker_id?: string;
  type: 'expense';
  category: ExpenseCategory;
  description: string;
  amount: number;
  is_active?: boolean;
  status?: 'active' | 'void';
  source_namespace?: string;
  source_row_key?: string;
  source_fingerprint?: string;
}

export interface Worker {
  id: string;
  name: string;
  daily: number;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
}

export type SiteStatus = 'scheduled' | 'active' | 'completed';

export interface Site {
  id: string;
  name: string;
  budget: number;
  company_name?: string;
  status: SiteStatus;
}

export interface WorkLog {
  id: string;
  date: string;
  site_id: string;
  worker_id: string;
  md: number;
  note?: string;
}

export type ChecklistType = 'receivable' | 'payable' | 'task' | 'material';
export type ChecklistStatus = 'pending' | 'invoiced' | 'completed';
export type ShippingType = 'prepaid' | 'postpaid' | 'delivery';
export type PaymentStatus = 'requested' | 'not_requested' | 'received' | 'not_received';

export interface ChecklistItem {
  id: string;
  type: ChecklistType;
  date: string;
  title: string;
  amount: number;
  status: ChecklistStatus;
  memo?: string;
  // 자재 관련 추가 필드
  supplier?: string; // 거래처
  quantity?: number; // 수량
  unitPrice?: number; // 단가
  shippingType?: ShippingType; // 운임 타입
  paymentStatus?: PaymentStatus; // 결제 상태
}

export interface AppState {
  sites: Site[];
  customers: Customer[];
  workers: Worker[];
  workLogs: WorkLog[];
  transactions: Transaction[];
  checklists: ChecklistItem[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
