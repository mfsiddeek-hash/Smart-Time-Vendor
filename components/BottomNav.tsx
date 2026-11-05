import React from 'react';
import { BookText, Wallet, Receipt, UserCircle } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  activeTheme: string;
}

const getThemeTextColor = (theme: string) => {
  const colors: Record<string, string> = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    dark: 'text-slate-800',
  };
  return colors[theme] || 'text-blue-600';
};

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate, activeTheme }) => {
  const activeColorClass = getThemeTextColor(activeTheme);
  
  const isDashboard = currentView === 'DASHBOARD' || currentView === 'DETAIL' || currentView === 'TRANSACTION_FORM';
  const isCashBook = currentView === 'CASH_BOOK';
  const isProfile = currentView === 'PROFILE';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0b101d] border-t border-slate-200 dark:border-[#1e2a3c] py-2 px-6 flex justify-between items-center z-40 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)] dark:shadow-none">
      <button 
        onClick={() => onNavigate('DASHBOARD')}
        className={`flex flex-col items-center gap-1 transition-colors ${isDashboard ? `${activeColorClass} dark:text-blue-400 font-bold` : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
      >
        <BookText size={20} />
        <span className="text-[10px] font-medium">Credit Book</span>
      </button>
      
      <button 
        onClick={() => onNavigate('CASH_BOOK')}
        className={`flex flex-col items-center gap-1 transition-colors ${isCashBook ? `${activeColorClass} dark:text-blue-400 font-bold` : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
      >
        <Wallet size={20} />
        <span className="text-[10px] font-medium">Sales & Expense</span>
      </button>
      
      <button className="flex flex-col items-center text-slate-400 dark:text-slate-600 gap-1 opacity-50">
        <Receipt size={20} />
        <span className="text-[10px] font-medium">Invoice</span>
      </button>
      
      <button 
        onClick={() => onNavigate('PROFILE')}
        className={`flex flex-col items-center gap-1 transition-colors ${isProfile ? `${activeColorClass} dark:text-blue-400 font-bold` : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
      >
        <UserCircle size={20} />
        <span className="text-[10px] font-medium">Profile</span>
      </button>
    </div>
  );
};