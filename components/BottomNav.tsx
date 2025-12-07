import React from 'react';
import { BookText, Wallet, Receipt, UserCircle } from 'lucide-react';

export const BottomNav: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-6 flex justify-between items-center z-40 pb-safe">
      <div className="flex flex-col items-center text-blue-600 gap-1">
        <BookText size={20} />
        <span className="text-[10px] font-medium">Credit Book</span>
      </div>
      <div className="flex flex-col items-center text-gray-400 gap-1">
        <Wallet size={20} />
        <span className="text-[10px] font-medium">Cash Book</span>
      </div>
      <div className="flex flex-col items-center text-gray-400 gap-1">
        <Receipt size={20} />
        <span className="text-[10px] font-medium">Invoice</span>
      </div>
      <div className="flex flex-col items-center text-gray-400 gap-1">
        <UserCircle size={20} />
        <span className="text-[10px] font-medium">Profile</span>
      </div>
    </div>
  );
};