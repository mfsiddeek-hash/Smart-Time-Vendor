import React from 'react';
import { BookText, Wallet, Receipt, UserCircle } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: any) => void;
  activeTheme: string; // 'blue' | 'purple' | etc
}

// Helper to get text color class based on theme
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
  
  const isDashboard = currentView === 'DASHBOARD' || currentView === 'DETAIL';
  const isProfile = currentView === 'PROFILE';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-6 flex justify-between items-center z-40 pb-safe">
      <button 
        onClick={() => onNavigate('DASHBOARD')}
        className={`flex flex-col items-center gap-1 transition-colors ${isDashboard ? activeColorClass : 'text-gray-400'}`}
      >
        <BookText size={20} />
        <span className="text-[10px] font-medium">Credit Book</span>
      </button>
      
      <button className="flex flex-col items-center text-gray-400 gap-1">
        <Wallet size={20} />
        <span className="text-[10px] font-medium">Cash Book</span>
      </button>
      
      <button className="flex flex-col items-center text-gray-400 gap-1">
        <Receipt size={20} />
        <span className="text-[10px] font-medium">Invoice</span>
      </button>
      
      <button 
        onClick={() => onNavigate('PROFILE')}
        className={`flex flex-col items-center gap-1 transition-colors ${isProfile ? activeColorClass : 'text-gray-400'}`}
      >
        <UserCircle size={20} />
        <span className="text-[10px] font-medium">Profile</span>
      </button>
    </div>
  );
};