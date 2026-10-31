import React from 'react';
import { FileText, Banknote, Building2, CreditCard, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Transaction, PaymentMethod, ChequeStatus } from '../types';

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

export const parsePaymentMethod = (desc?: string, explicitMethod?: PaymentMethod, explicitStatus?: ChequeStatus): ParsedTransactionMetadata => {
  const result: ParsedTransactionMetadata = {
    method: explicitMethod,
    chequeStatus: explicitStatus,
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
  onClick?: (transaction: Transaction) => void;
  onPassCheque?: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick, onPassCheque }) => {
  const isPayment = transaction.type === 'PAYMENT';
  const parsed = parsePaymentMethod(transaction.description, transaction.paymentMethod, transaction.chequeStatus);
  const pendingCheque = isPendingCheque(transaction);
  const isCheque = parsed.method === 'Cheque' || transaction.paymentMethod === 'Cheque';

  return (
    <div 
      onClick={() => onClick?.(transaction)}
      className={`p-4 border-b border-gray-100 flex flex-col gap-2 transition-colors cursor-pointer hover:bg-slate-50/70 ${
        pendingCheque ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : 'bg-white'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-slate-800">{transaction.date}</span>
          {pendingCheque && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              <Clock size={11} className="animate-pulse" />
              On Hold • Not Passed
            </span>
          )}
        </div>
        <div className="text-right">
          <span className={`font-bold text-base ${
            pendingCheque 
              ? 'text-amber-800 font-extrabold' 
              : isPayment 
              ? 'text-green-700' 
              : 'text-red-600'
          }`}>
            {pendingCheque ? '⏳ ' : (isPayment ? '+' : '-')} LKR {transaction.amount.toLocaleString()}
          </span>
          {pendingCheque && (
            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Amount Not Changed</p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end gap-2">
        <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isCheque ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                pendingCheque
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                {pendingCheque ? <Clock size={12} className="text-amber-700" /> : <CheckCircle2 size={12} className="text-emerald-700" />}
                <span>Cheque {pendingCheque ? '(Pending Clearance)' : '(Passed / Cleared)'}</span>
                {parsed.chequeNumber && (
                  <span className="opacity-90 font-mono">#{parsed.chequeNumber}</span>
                )}
              </span>
            ) : (
              isPayment && parsed.method && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  parsed.method === 'Bank Transfer' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : parsed.method === 'Card'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {parsed.method === 'Bank Transfer' ? <Building2 size={12} /> : parsed.method === 'Card' ? <CreditCard size={12} /> : <Banknote size={12} />}
                  {parsed.method}
                </span>
              )
            )}

            {parsed.chequeDate && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                Cheque Date: {parsed.chequeDate}
              </span>
            )}

            {parsed.cleanNotes ? (
              <span className="text-sm text-slate-600 font-medium truncate">{parsed.cleanNotes}</span>
            ) : (!parsed.method && transaction.description ? (
              <span className="text-sm text-gray-500 uppercase font-medium truncate">{transaction.description}</span>
            ) : null)}
          </div>

          {transaction.hasAttachment && (
            <div className="w-8 h-10 border border-gray-200 rounded flex items-center justify-center bg-gray-50 mt-1">
              <FileText size={14} className="text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
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
          <span className="text-xs text-gray-500 font-bold">
            Bal. LKR {transaction.balanceAfter.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};