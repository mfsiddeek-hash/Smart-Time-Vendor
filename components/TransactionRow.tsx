import React from 'react';
import { FileText, Banknote, Building2, CreditCard, Clock, CheckCircle2, AlertCircle, Receipt } from 'lucide-react';
import { Transaction, PaymentMethod, ChequeStatus, ContactType } from '../types';

export interface ParsedTransactionMetadata {
  method?: PaymentMethod;
  chequeStatus?: ChequeStatus;
  chequeNumber?: string;
  chequeDate?: string;
  cleanNotes: string;
}

export const isPendingCheque = (t: Transaction): boolean => {
  if (t.chequeStatus === 'PASSED') return false;
  if (t.chequeStatus === 'BOUNCED') return false;
  if (t.chequeStatus === 'PENDING') return true;
  
  const desc = t.description || '';
  const isCheque = t.paymentMethod === 'Cheque' || desc.toLowerCase().includes('cheque');
  if (!isCheque) return false;
  
  if (desc.includes('[PASSED]') || desc.includes('[CLEARED]') || desc.includes('Status: Passed')) return false;
  if (desc.includes('[BOUNCED]')) return false;
  return true;
};

const formatDisplayDate = (dStr: string | null | undefined) => {
  if (!dStr) return '-';
  const parts = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const y = parseInt(parts[1]);
    const m = parseInt(parts[2]) - 1;
    const d = parseInt(parts[3]);
    const dateObj = new Date(y, m, d);
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dStr;
};

export const parsePaymentMethod = (
  desc?: string, 
  explicitMethod?: PaymentMethod, 
  explicitStatus?: ChequeStatus,
  explicitChequeDate?: string
): ParsedTransactionMetadata => {
  const result: ParsedTransactionMetadata = {
    method: explicitMethod,
    chequeStatus: explicitStatus,
    chequeDate: explicitChequeDate,
    cleanNotes: desc || ''
  };

  if (!desc) return result;
  const trimmed = desc.trim();

  // Check Cheque format
  if (explicitMethod === 'Cheque' || trimmed.startsWith('Cheque')) {
    result.method = 'Cheque';
    
    // Status
    if (!result.chequeStatus) {
      if (trimmed.includes('[PASSED]') || trimmed.includes('[CLEARED]') || trimmed.includes('Status: Passed')) {
        result.chequeStatus = 'PASSED';
      } else if (trimmed.includes('[BOUNCED]')) {
        result.chequeStatus = 'BOUNCED';
      } else {
        result.chequeStatus = 'PENDING';
      }
    }

    // Cheque Number: #12345
    const chqNumMatch = trimmed.match(/#([A-Za-z0-9-]+)/);
    if (chqNumMatch) {
      result.chequeNumber = chqNumMatch[1];
    }

    // Due / Maturity Date: Due: 2026-11-15
    const dueDateMatch = trimmed.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
    if (dueDateMatch) {
      result.chequeDate = dueDateMatch[1];
    } else if (explicitChequeDate) {
      result.chequeDate = explicitChequeDate;
    }

    // Clean notes by removing technical prefixes
    let notes = trimmed
      .replace(/^Cheque\s*(\[(PENDING|PASSED|BOUNCED)\])?/i, '')
      .replace(/•\s*#(?:[A-Za-z0-9-]+)/g, '')
      .replace(/•\s*(?:Due|Date):\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/^[•\s-]+|[•\s-]+$/g, '')
      .trim();

    result.cleanNotes = notes;
    return result;
  }

  if (trimmed.startsWith('Bank Transfer • ')) {
    return { ...result, method: 'Bank Transfer', cleanNotes: trimmed.substring(16).trim() };
  }
  if (trimmed === 'Bank Transfer') {
    return { ...result, method: 'Bank Transfer', cleanNotes: '' };
  }
  if (trimmed.startsWith('Card • ')) {
    return { ...result, method: 'Card', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Card') {
    return { ...result, method: 'Card', cleanNotes: '' };
  }
  if (trimmed.startsWith('Cash • ')) {
    return { ...result, method: 'Cash', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Cash') {
    return { ...result, method: 'Cash', cleanNotes: '' };
  }

  return result;
};

interface TransactionRowProps {
  transaction: Transaction;
  contactType?: ContactType;
  onClick?: (transaction: Transaction) => void;
  onPassCheque?: (transaction: Transaction) => void;
  onViewInvoice?: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, contactType, onClick, onPassCheque, onViewInvoice }) => {
  const isPayment = transaction.type === 'PAYMENT';
  const parsed = parsePaymentMethod(
    transaction.description, 
    transaction.paymentMethod, 
    transaction.chequeStatus,
    transaction.chequeDate
  );
  const pendingCheque = isPendingCheque(transaction);
  const isCheque = parsed.method === 'Cheque' || transaction.paymentMethod === 'Cheque';
  const chqDueDate = parsed.chequeDate || transaction.chequeDate || transaction.date;

  return (
    <div 
      onClick={() => onClick?.(transaction)}
      className={`p-4 border-b border-slate-100 dark:border-[#1e2a3c] flex flex-col gap-2 transition-colors cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#172235] ${
        pendingCheque ? 'bg-amber-50/40 dark:bg-amber-950/20 border-l-4 border-l-amber-500' : 'bg-white dark:bg-[#131b2a]'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-slate-800 dark:text-slate-100">{formatDisplayDate(transaction.date)}</span>
          {pendingCheque && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
              <Clock size={11} className="animate-pulse" />
              Post-Dated Cheque (On Hold)
            </span>
          )}
        </div>
        <div className="text-right">
          <span className={`font-bold text-base ${
            pendingCheque 
              ? 'text-amber-800 dark:text-amber-400 font-extrabold' 
              : isPayment 
              ? 'text-emerald-700 dark:text-emerald-400' 
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {pendingCheque ? '⏳ ' : (isPayment ? '+' : '-')} LKR {transaction.amount.toLocaleString()}
          </span>
          {pendingCheque && (
            <p className="text-[10px] text-amber-800 dark:text-amber-400 font-bold tracking-wider">
              Due Date: {formatDisplayDate(chqDueDate)} • Amount On Hold
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end gap-2">
        <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isCheque ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                pendingCheque
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
              }`}>
                {pendingCheque ? <Clock size={12} className="text-amber-700 dark:text-amber-400" /> : <CheckCircle2 size={12} className="text-emerald-700 dark:text-emerald-400" />}
                <span>Cheque {pendingCheque ? '(Pending Clearance)' : '(Passed / Cleared)'}</span>
                {parsed.chequeNumber && (
                  <span className="opacity-90 font-mono">#{parsed.chequeNumber}</span>
                )}
              </span>
            ) : (
              isPayment && parsed.method && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  parsed.method === 'Bank Transfer' 
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50' 
                    : parsed.method === 'Card'
                    ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                }`}>
                  {parsed.method === 'Bank Transfer' ? <Building2 size={12} /> : parsed.method === 'Card' ? <CreditCard size={12} /> : <Banknote size={12} />}
                  {parsed.method}
                </span>
              )
            )}

            {(isPayment || (contactType === 'RENT' && transaction.type === 'CREDIT')) && contactType && (
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                contactType === 'CUSTOMER'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                  : contactType === 'VENDOR'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                  : contactType === 'RENT'
                  ? (transaction.type === 'CREDIT' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50')
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
              }`}>
                {contactType === 'CUSTOMER' ? 'Linked to Sales' :
                 contactType === 'VENDOR' ? 'Linked to Expenses' :
                 contactType === 'RENT' ? (transaction.type === 'CREDIT' ? 'Linked to Sales (+ Sale)' : 'Shop Rent Expense') :
                 'Linked to Sales'}
              </span>
            )}

            {isCheque && chqDueDate && (
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-[#1a2538] text-amber-950 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-[#2b3a54] flex items-center gap-1">
                <Clock size={10} className="text-amber-700 dark:text-amber-400" />
                <span>Due Date: {formatDisplayDate(chqDueDate)}</span>
              </span>
            )}

            {parsed.cleanNotes ? (
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{parsed.cleanNotes}</span>
            ) : (!parsed.method && transaction.description ? (
              <span className="text-sm text-slate-500 dark:text-slate-400 uppercase font-medium truncate">{transaction.description}</span>
            ) : null)}
          </div>

          {transaction.hasAttachment && (
            <div className="w-8 h-10 border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-800 mt-1">
              <FileText size={14} className="text-slate-400" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {onViewInvoice && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewInvoice(transaction);
                }}
                className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                title="View & Print Invoice / POS Receipt"
              >
                <Receipt size={13} />
                <span>Invoice</span>
              </button>
            )}

            {pendingCheque && onPassCheque && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPassCheque(transaction);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                title="Pass / Clear this cheque and apply amount to balance"
              >
                <CheckCircle2 size={13} />
                <span>Pass Cheque</span>
              </button>
            )}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            Bal. LKR {transaction.balanceAfter.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};