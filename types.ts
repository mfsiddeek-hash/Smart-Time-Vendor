export type ContactType = 'CUSTOMER' | 'SUPPLIER' | 'RENT';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
  balance: number; // For RENT: Amount Saved. For Others: Amount Owed/Due
  targetAmount?: number; // Only used for RENT
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