export type ContactType = 'CUSTOMER' | 'VENDOR' | 'RENT' | 'SERVICE';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
  balance: number; // For RENT: Amount Saved. For Others: Amount Owed/Due
  targetAmount?: number; // Only used for RENT
  startDate?: string; // Stored in DB (used for phoneModel in SERVICE)
  endDate?: string;   // Stored in DB (used for serviceStatus in SERVICE)
  phoneModel?: string;
  serviceStatus?: string;
  totalCost?: number;
  advancePayment?: number;
  advanceDate?: string;
  orderDate?: string;
  collectedItems?: string[]; // e.g. ['SIM', 'SIM Tray', 'Back Cover', 'Battery', 'Back Panel']
  otherCollectedItems?: string;
  lastUpdated: string;
}

export type TransactionType = 'CREDIT' | 'PAYMENT';

export interface Transaction {
  id: string;
  contactId: string;
  date: string; // ISO string or formatted string
  description?: string;
  amount: number;
  type: TransactionType;
  balanceAfter: number;
  hasAttachment?: boolean;
  attachmentUrl?: string | null;
}

export interface SummaryStats {
  toCollect: number;
  toPay: number;
}

export type UserRole = 'Admin' | 'Manager' | 'Cashier' | 'Technician';

export interface UserPermissions {
  canDeleteData: boolean;    // Delete rights for contacts, service orders, transactions, payments
  canEditData: boolean;      // Edit rights for orders, records, amounts
  canManageUsers: boolean;   // Admin rights to manage team users and settings
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  phone?: string;
  pin?: string;
  password?: string;
  permissions?: UserPermissions;
  createdAt: string;
}

export interface StoreProfile {
  shopName: string;
  tagline: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
}