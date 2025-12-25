export type ContactType = 'CUSTOMER' | 'VENDOR' | 'RENT';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
  balance: number; // For RENT: Amount Saved. For Others: Amount Owed/Due
  targetAmount?: number; // Only used for RENT
  startDate?: string; // ISO date string YYYY-MM-DD
  endDate?: string;   // ISO date string YYYY-MM-DD
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