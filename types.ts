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