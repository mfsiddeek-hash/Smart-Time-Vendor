import React from 'react';
import { FileText, Banknote, Building2, CreditCard } from 'lucide-react';
import { Transaction, PaymentMethod } from '../types';

export const parsePaymentMethod = (desc?: string, explicitMethod?: PaymentMethod): { method?: PaymentMethod; cleanNotes: string } => {
  if (explicitMethod) {
    return { method: explicitMethod, cleanNotes: desc || '' };
  }
  if (!desc) return { cleanNotes: '' };
  const trimmed = desc.trim();
  if (trimmed.startsWith('Bank Transfer • ')) {
    return { method: 'Bank Transfer', cleanNotes: trimmed.substring(16).trim() };
  }
  if (trimmed === 'Bank Transfer') {
    return { method: 'Bank Transfer', cleanNotes: '' };
  }
  if (trimmed.startsWith('Card • ')) {
    return { method: 'Card', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Card') {
    return { method: 'Card', cleanNotes: '' };
  }
  if (trimmed.startsWith('Cash • ')) {
    return { method: 'Cash', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Cash') {
    return { method: 'Cash', cleanNotes: '' };
  }
  return { cleanNotes: trimmed };
};

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick }) => {
  // Logic to determine color based on transaction type relative to a Vendor perspective
  // Payment reduces balance (Good/Green), Credit increases balance (Debt/Red)
  
  const isPayment = transaction.type === 'PAYMENT';
  const { method, cleanNotes } = parsePaymentMethod(transaction.description, transaction.paymentMethod);
  
  return (
    <div 
      onClick={() => onClick?.(transaction)}
      className="bg-white p-4 border-b border-gray-100 flex flex-col gap-2 active:bg-gray-50 transition-colors cursor-pointer hover:bg-slate-50/60"
    >
      <div className="flex justify-between items-start">
        <span className="font-bold text-base text-slate-800">{transaction.date}</span>
        <span className={`font-bold text-base ${isPayment ? 'text-green-700' : 'text-red-600'}`}>
          {isPayment ? '+' : '-'} LKR {transaction.amount.toLocaleString()}
        </span>
      </div>

      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isPayment && method && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                method === 'Bank Transfer' 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : method === 'Card'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {method === 'Bank Transfer' ? <Building2 size={12} /> : method === 'Card' ? <CreditCard size={12} /> : <Banknote size={12} />}
                {method}
              </span>
            )}
            {cleanNotes ? (
              <span className="text-sm text-slate-600 font-medium">{cleanNotes}</span>
            ) : (!method && transaction.description ? (
              <span className="text-sm text-gray-500 uppercase font-medium">{transaction.description}</span>
            ) : null)}
          </div>
          {transaction.hasAttachment && (
            <div className="w-8 h-10 border border-gray-200 rounded flex items-center justify-center bg-gray-50 mt-1">
              <FileText size={14} className="text-gray-400" />
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-500 font-bold shrink-0">
          Bal. LKR {transaction.balanceAfter.toLocaleString()}
        </span>
      </div>
    </div>
  );
};