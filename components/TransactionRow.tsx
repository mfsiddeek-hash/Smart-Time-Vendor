import React from 'react';
import { FileText } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick }) => {
  // Logic to determine color based on transaction type relative to a Supplier perspective
  // Payment reduces balance (Good/Green), Credit increases balance (Debt/Red)
  
  const isPayment = transaction.type === 'PAYMENT';
  
  return (
    <div 
      onClick={() => onClick?.(transaction)}
      className="bg-white p-4 border-b border-gray-100 flex flex-col gap-2 active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <span className="font-bold text-base text-slate-800">{transaction.date}</span>
        <span className={`font-bold text-base ${isPayment ? 'text-green-700' : 'text-red-600'}`}>
          Rs. {transaction.amount.toLocaleString()}
        </span>
      </div>

      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          {transaction.description && (
            <span className="text-sm text-gray-400 uppercase font-medium">{transaction.description}</span>
          )}
          {transaction.hasAttachment && (
            <div className="w-8 h-10 border border-gray-200 rounded flex items-center justify-center bg-gray-50 mt-1">
              <FileText size={14} className="text-gray-400" />
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-500 font-bold">
          Bal. Rs.{transaction.balanceAfter.toLocaleString()}
        </span>
      </div>
    </div>
  );
};