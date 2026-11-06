import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, EyeOff, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight, Database, AlertCircle, History, TrendingUp, TrendingDown, Settings, ShieldAlert, X,
  RotateCcw, Wrench, Smartphone, Printer, Key, KeyRound, Lock, Unlock, ShieldCheck, UserPlus, Upload,
  Image as ImageIcon, CheckCircle2, UserCheck, Shield, Copy, ExternalLink, Delete, Hash, Package,
  Banknote, CreditCard, Building2, Clock, Landmark, CheckSquare, Minus, Tag, ArrowUpRight, ArrowDownRight,
  Sun, Moon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Contact, ContactType, Transaction, TransactionType, PaymentMethod, ChequeStatus, AppUser, UserRole, StoreProfile, UserPermissions, CashbookEntry, CashbookEntryType, UserProfile } from './types';
import { BottomNav } from './components/BottomNav';
import { TransactionRow, parsePaymentMethod, isPendingCheque } from './components/TransactionRow';
import { supabase, SUPABASE_PROJECT_NAME, SUPABASE_PROJECT_ID, SUPABASE_URL, loadUserProfile } from './supabaseClient';
import { AuthScreen, AuthMode } from './components/AuthScreen';
import { ShopSetupScreen } from './components/ShopSetupScreen';

export const DEFAULT_COLLECTED_ITEMS = [
  'SIM Card',
  'SIM Tray',
  'Back Cover',
  'Battery',
  'Back Panel',
  'Memory Card (SD)',
  'Charger / Cable',
  'Original Box'
] as const;

export const SALE_CATEGORIES = [
  'Customer Payment',
  'Mobile Accessories',
  'Repair Charges',
  'Mobile Phone Sales',
  'Spare Parts Sale',
  'SIM / Reload',
  'Software / Unlocking',
  'Other Sales'
] as const;

export const EXPENSE_CATEGORIES = [
  'Vendor Payment',
  'Shop Rent',
  'Electricity / Bills',
  'Staff Wages / Salary',
  'Parts Purchase',
  'Food & Tea',
  'Transport / Delivery',
  'Internet / Phone Bills',
  'Shop Maintenance / Tools',
  'Other Expense'
] as const;

type ThemeColor = 'blue' | 'purple' | 'emerald' | 'orange' | 'dark';

const THEMES: Record<ThemeColor, any> = {
  blue: { name: 'Blue', primary: 'bg-blue-600', primaryActive: 'active:bg-blue-700', text: 'text-blue-600', light: 'bg-blue-50', lightHover: 'hover:bg-blue-100', border: 'border-blue-200', bgIndicator: 'bg-blue-500' },
  purple: { name: 'Purple', primary: 'bg-purple-600', primaryActive: 'active:bg-purple-700', text: 'text-purple-600', light: 'bg-purple-50', lightHover: 'hover:bg-purple-100', border: 'border-purple-200', bgIndicator: 'bg-purple-500' },
  emerald: { name: 'Emerald', primary: 'bg-emerald-600', primaryActive: 'active:bg-emerald-700', text: 'text-emerald-600', light: 'bg-emerald-50', lightHover: 'hover:bg-emerald-100', border: 'border-emerald-200', bgIndicator: 'bg-emerald-500' },
  orange: { name: 'Orange', primary: 'bg-orange-600', primaryActive: 'active:bg-orange-700', text: 'text-orange-600', light: 'bg-orange-50', lightHover: 'hover:bg-orange-100', border: 'border-orange-200', bgIndicator: 'bg-orange-500' },
  dark: { name: 'Dark', primary: 'bg-slate-800', primaryActive: 'active:bg-slate-900', text: 'text-slate-800', light: 'bg-gray-100', lightHover: 'hover:bg-gray-200', border: 'border-gray-200', bgIndicator: 'bg-slate-800' },
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const normalizeToLocalMidnight = (dateString: string | null | undefined) => {
  if (!dateString) return new Date();
  
  const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1]);
    const m = parseInt(match[2]);
    const d = parseInt(match[3]);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  
  return new Date(1970, 0, 1);
};

const getRentCycleStart = () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  let cycleStart;
  if (day >= 13) { cycleStart = new Date(year, month, 13); } 
  else { cycleStart = new Date(year, month - 1, 13); }
  cycleStart.setHours(0, 0, 0, 0);
  return cycleStart;
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

export default function App() {
  const [currentView, setCurrentView] = useState<string>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<ContactType>('VENDOR');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Theme Dark / Light Mode State (default to dark mode as per design attachment)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('st_theme_mode');
      if (saved) return saved === 'dark';
    } catch {}
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('st_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('st_theme_mode', 'light');
    }
  }, [isDarkMode]);
  
  // Supabase Auth & User Profile State
  const [authSession, setAuthSession] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem('st_cached_contacts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('st_cached_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const contactsRef = useRef(contacts);

  // Cashbook / Sales & Expense state
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>(() => {
    try {
      const saved = localStorage.getItem('st_cashbook_entries');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isCashbookModalOpen, setIsCashbookModalOpen] = useState(false);
  const [editingCashbookEntry, setEditingCashbookEntry] = useState<CashbookEntry | null>(null);
  const [cashbookType, setCashbookType] = useState<CashbookEntryType>('SALE');
  const [cashbookAmount, setCashbookAmount] = useState('');
  const [cashbookDate, setCashbookDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashbookCategory, setCashbookCategory] = useState<string>('Mobile Accessories');
  const [cashbookCustomCategory, setCashbookCustomCategory] = useState('');
  const [cashbookDesc, setCashbookDesc] = useState('');
  const [cashbookPaymentMethod, setCashbookPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashbookRefNo, setCashbookRefNo] = useState('');
  const [cashbookContactName, setCashbookContactName] = useState('');

  // Cashbook filter states
  const [cashbookDateFilter, setCashbookDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  const [cashbookCustomStart, setCashbookCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [cashbookCustomEnd, setCashbookCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashbookTypeFilter, setCashbookTypeFilter] = useState<'ALL' | 'SALE' | 'EXPENSE'>('ALL');
  const [cashbookCategoryFilter, setCashbookCategoryFilter] = useState<string>('ALL');
  const [cashbookSearch, setCashbookSearch] = useState('');
  const cashbookDateInputRef = useRef<HTMLInputElement>(null);
  const cashbookCustomStartRef = useRef<HTMLInputElement>(null);
  const cashbookCustomEndRef = useRef<HTMLInputElement>(null);

  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'needs_tables' | 'error'>('checking');
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [dismissDbAlert, setDismissDbAlert] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  
  const [shopName, setShopName] = useState<string>('');
  const [shopTagline, setShopTagline] = useState<string>('Mobile Phone Repair & Service');
  const [shopPhone, setShopPhone] = useState<string>('');
  const [shopAddress, setShopAddress] = useState<string>('');
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>(() => localStorage.getItem('st_current_user_id') || '');

  // Isolated Users Save Helper per Shop Owner Account
  const saveAccountUsers = (updatedUsers: AppUser[]) => {
    setUsers(updatedUsers);
    if (authUser?.id) {
      localStorage.setItem(`st_app_users_${authUser.id}`, JSON.stringify(updatedUsers));
    } else {
      localStorage.setItem('st_app_users', JSON.stringify(updatedUsers));
    }
  };

  // Synchronize and isolate staff accounts per authenticated Supabase account
  useEffect(() => {
    if (!authUser?.id) return;
    const storageKey = `st_app_users_${authUser.id}`;
    const ownerName = userProfile?.fullName || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Shop Owner (Admin)';
    const ownerUsername = authUser.email || 'owner';

    const defaultOwner: AppUser = {
      id: `owner-${authUser.id}`,
      name: ownerName,
      username: ownerUsername,
      role: 'Admin',
      status: 'Active',
      phone: userProfile?.phone || '',
      permissions: {
        canDeleteData: true,
        canEditData: true,
        canManageUsers: true
      },
      createdAt: new Date().toISOString().slice(0, 10)
    };

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const updated = parsed.map((u: AppUser) => {
            if (u.role === 'Admin' || u.id.startsWith('owner-') || u.permissions?.canManageUsers) {
              return {
                ...u,
                name: ownerName,
                username: ownerUsername,
                phone: userProfile?.phone || u.phone || ''
              };
            }
            return u;
          });
          setUsers(updated);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          if (!updated.some((u: AppUser) => u.id === currentUserId)) {
            setCurrentUserId(updated[0].id);
            localStorage.setItem('st_current_user_id', updated[0].id);
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to parse saved users for account', e);
      }
    }

    // Default for new shop owner account: Only the Shop Owner Admin profile (no shared staff)
    const initialList = [defaultOwner];
    setUsers(initialList);
    setCurrentUserId(defaultOwner.id);
    localStorage.setItem('st_current_user_id', defaultOwner.id);
    localStorage.setItem(storageKey, JSON.stringify(initialList));
  }, [authUser?.id, userProfile?.fullName, userProfile?.phone, authUser?.email]);

  // Supabase Auth session controls primary access
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('st_auth_active') === 'true';
  });

  const [profileTab, setProfileTab] = useState<'STORE' | 'USERS' | 'DATA'>('STORE');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetOperatorId, setTargetOperatorId] = useState<string | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<{ 
    name: string; 
    username: string; 
    role: UserRole; 
    phone: string; 
    status: 'Active' | 'Inactive'; 
    canDeleteData: boolean;
    canEditData: boolean;
    canManageUsers: boolean;
  }>({
    name: '', 
    username: '', 
    role: 'Cashier', 
    phone: '', 
    status: 'Active', 
    canDeleteData: false,
    canEditData: true,
    canManageUsers: false
  });
  const [profileToast, setProfileToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentUser = useMemo(() => {
    return users.find(u => u.id === currentUserId) || users[0] || {
      id: `owner-${authUser?.id || 'default'}`, 
      name: userProfile?.fullName || authUser?.email || 'Shop Owner', 
      username: authUser?.email || 'owner', 
      role: 'Admin' as UserRole, 
      status: 'Active' as const, 
      permissions: { canDeleteData: true, canEditData: true, canManageUsers: true },
      createdAt: ''
    };
  }, [users, currentUserId, authUser, userProfile]);

  // User Rights & Permissions logic
  const userCanDelete = useMemo(() => {
    if (currentUser?.permissions?.canDeleteData !== undefined) {
      return Boolean(currentUser.permissions.canDeleteData);
    }
    return currentUser?.role === 'Admin';
  }, [currentUser]);

  const userCanEdit = useMemo(() => {
    if (currentUser?.permissions?.canEditData !== undefined) {
      return Boolean(currentUser.permissions.canEditData);
    }
    return true;
  }, [currentUser]);

  const userCanManageUsers = useMemo(() => {
    if (currentUser?.permissions?.canManageUsers !== undefined) {
      return Boolean(currentUser.permissions.canManageUsers);
    }
    return currentUser?.role === 'Admin';
  }, [currentUser]);

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to sign out of your shop account?")) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
      setAuthSession(null);
      setAuthUser(null);
      setUserProfile(null);
      setShopName('');
      setShopPhone('');
      setShopAddress('');
      setShopLogo(null);
      setShopTagline('Mobile Phone Repair & Service');
      setContacts([]);
      setTransactions([]);
      setCashbookEntries([]);
      setIsAuthenticated(false);
      sessionStorage.removeItem('st_auth_active');
      setCurrentView('DASHBOARD');
      setSelectedContact(null);
      showProfileToast("You have been signed out.");
    }
  };

  const showProfileToast = (text: string, type: 'success' | 'error' = 'success') => {
    setProfileToast({ text, type });
    setTimeout(() => setProfileToast(null), 3500);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);

  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPhoneModel, setAddPhoneModel] = useState('');
  const [addTotalCost, setAddTotalCost] = useState('');
  const [addAdvancePayment, setAddAdvancePayment] = useState('');
  const [addOrderDate, setAddOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [addAdvanceDate, setAddAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [addServiceStatus, setAddServiceStatus] = useState('Pending');
  const [addCollectedItems, setAddCollectedItems] = useState<string[]>([]);
  const [addOtherCollectedItems, setAddOtherCollectedItems] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState('30000');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');
  const [transPaymentMethod, setTransPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transChequeNumber, setTransChequeNumber] = useState('');
  const [transChequeDate, setTransChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [transChequeStatus, setTransChequeStatus] = useState<ChequeStatus>('PENDING');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });
  const [reportTarget, setReportTarget] = useState<'CATEGORY' | 'CONTACT'>('CATEGORY');

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewServiceOrder, setPreviewServiceOrder] = useState<Contact | null>(null);
  const [printMenuContactId, setPrintMenuContactId] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'POS' | 'A4'>('POS');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const chequeDateInputRef = useRef<HTMLInputElement>(null);
  const orderDateInputRef = useRef<HTMLInputElement>(null);
  const advanceDateInputRef = useRef<HTMLInputElement>(null);

  const contactStats = useMemo(() => {
    const stats: Record<string, { 
      totalCredit: number; 
      totalPayment: number; 
      balance: number;
      pendingChequesCount: number;
      pendingChequesAmount: number;
    }> = {};
    contacts.forEach(c => stats[c.id] = { totalCredit: 0, totalPayment: 0, balance: 0, pendingChequesCount: 0, pendingChequesAmount: 0 });
    
    transactions.forEach(t => {
      if (!stats[t.contactId]) return;
      // Pending Cheques: DO NOT change balance or totals until passed
      if (isPendingCheque(t)) {
        stats[t.contactId].pendingChequesCount += 1;
        stats[t.contactId].pendingChequesAmount += t.amount;
        return;
      }
      if (t.type === 'CREDIT') stats[t.contactId].totalCredit += t.amount;
      else stats[t.contactId].totalPayment += t.amount;
    });

    contacts.forEach(c => {
      const s = stats[c.id];
      if (c.type === 'RENT') {
        s.balance = s.totalPayment - s.totalCredit;
      } else {
        s.balance = s.totalCredit - s.totalPayment;
      }
    });
    return stats;
  }, [contacts, transactions]);

  const cycleSavingsMap = useMemo(() => {
    const savings: Record<string, number> = {};
    const cycleStart = getRentCycleStart();
    
    contacts.filter(c => c.type === 'RENT').forEach(c => {
      savings[c.id] = transactions
        .filter(t => t.contactId === c.id && !isPendingCheque(t) && normalizeToLocalMidnight(t.date) >= cycleStart)
        .reduce((sum, t) => sum + (t.type === 'PAYMENT' ? t.amount : -t.amount), 0);
    });
    return savings;
  }, [contacts, transactions]);

  const activeTotals = useMemo(() => {
    const currentContacts = contacts.filter(c => c.type === activeTab);
    let totalPayments = 0;
    let netBalance = 0;

    if (activeTab === 'RENT') {
      let totalTarget = 0;
      let totalSavedInCycle = 0;
      currentContacts.forEach(c => {
        totalPayments += contactStats[c.id]?.balance || 0;
        totalSavedInCycle += cycleSavingsMap[c.id] || 0;
        totalTarget += c.targetAmount || 30000;
      });
      netBalance = Math.max(0, totalTarget - totalSavedInCycle);
    } else {
      currentContacts.forEach(c => {
        const bal = contactStats[c.id]?.balance || 0;
        if (bal > 0) netBalance += bal;
        totalPayments += contactStats[c.id]?.totalPayment || 0;
      });
    }
    return { totalPayments, netBalance };
  }, [contacts, activeTab, contactStats, cycleSavingsMap]);

  const reportTotals = useMemo(() => {
    const start = normalizeToLocalMidnight(reportRange.start);
    const end = normalizeToLocalMidnight(reportRange.end);
    end.setHours(23, 59, 59, 999);
    
    let filteredTransactions = [];
    if (reportTarget === 'CATEGORY') {
      const categoryContacts = contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER')).map(c => c.id);
      filteredTransactions = transactions.filter(t => categoryContacts.includes(t.contactId));
    } else if (selectedContact) {
      filteredTransactions = transactions.filter(t => t.contactId === selectedContact.id);
    }

    const rangeTransactions = filteredTransactions.filter(t => {
      const d = normalizeToLocalMidnight(t.date);
      return d >= start && d <= end;
    });

    const totalPaid = rangeTransactions.filter(t => t.type === 'PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const totalCredit = rangeTransactions.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);

    return { totalPaid, totalCredit };
  }, [transactions, contacts, activeTab, selectedContact, reportRange, reportTarget]);

  // Helper to identify pending cheques in cashbook entries
  const isPendingCashbookEntry = (entry: CashbookEntry): boolean => {
    if (entry.paymentMethod === 'Cheque') {
      const desc = entry.description || '';
      if (desc.includes('[PASSED]') || desc.includes('[CLEARED]') || desc.includes('Status: Passed')) return false;
      if (desc.includes('[BOUNCED]')) return false;
      return true;
    }
    return false;
  };

  const todayCashbookSnapshot = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntries = cashbookEntries.filter(e => e.date === todayStr && !isPendingCashbookEntry(e));
    const sales = todayEntries.filter(e => e.type === 'SALE').reduce((s, e) => s + e.amount, 0);
    const expenses = todayEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
    return {
      count: todayEntries.length,
      sales,
      expenses,
      net: sales - expenses
    };
  }, [cashbookEntries]);

  const downloadCategoryReport = () => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      const currentContacts = contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER'));
      
      const start = normalizeToLocalMidnight(reportRange.start);
      const end = normalizeToLocalMidnight(reportRange.end);
      end.setHours(23, 59, 59, 999);

      const rangeTransactions = transactions.filter(t => {
        const d = normalizeToLocalMidnight(t.date);
        return d >= start && d <= end;
      });

      const contactReportData = currentContacts.map(c => {
        const cTrans = rangeTransactions.filter(t => t.contactId === c.id);
        const paid = cTrans.filter(t => t.type === 'PAYMENT').reduce((s, t) => s + t.amount, 0);
        const credit = cTrans.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
        const bal = credit - paid; 
        
        return { name: c.name, phone: c.phone || '-', paid, credit, bal };
      });

      doc.setFontSize(20);
      doc.text(`${shopName} - ${activeTab} Summary`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${timestamp}`, 14, 28);
      doc.text(`Period: ${reportRange.start} to ${reportRange.end}`, 14, 33);
      
      const tableData = contactReportData.map(d => [
        d.name,
        d.phone,
        `LKR ${d.credit.toLocaleString()}`,
        `LKR ${d.paid.toLocaleString()}`,
        `LKR ${Math.abs(d.bal).toLocaleString()}`
      ]);

      const totalCredit = contactReportData.reduce((s, d) => s + d.credit, 0);
      const totalPaid = contactReportData.reduce((s, d) => s + d.paid, 0);
      const netBalance = totalCredit - totalPaid;

      autoTable(doc, {
        startY: 40,
        head: [['Name', 'Phone', 'Range Credit', 'Range Paid', 'Range Balance']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        foot: [['Total', '', `LKR ${totalCredit.toLocaleString()}`, `LKR ${totalPaid.toLocaleString()}`, `LKR ${Math.abs(netBalance).toLocaleString()}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      
      const safeFileName = `${activeTab.toLowerCase()}_report_${Date.now()}.pdf`.replace(/[^a-z0-9._-]/gi, '_');
      doc.save(safeFileName);
      setIsReportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF report.");
    }
  };

  const downloadContactStatement = (contact: Contact) => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      const isRent = contact.type === 'RENT';
      
      doc.setFontSize(18);
      doc.text(shopName, 14, 20);
      doc.setFontSize(12);
      doc.text(`Statement for: ${contact.name}${contact.phoneModel ? ' (' + contact.phoneModel + ')' : ''}`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Period: ${reportRange.start} to ${reportRange.end} | Generated: ${timestamp}`, 14, 38);
      
      const start = normalizeToLocalMidnight(reportRange.start);
      const end = normalizeToLocalMidnight(reportRange.end);
      end.setHours(23, 59, 59, 999);

      const transactionsBefore = transactions
        .filter(t => t.contactId === contact.id && normalizeToLocalMidnight(t.date) < start);
      
      let openingBalance = 0;
      transactionsBefore.forEach(t => {
        if (isRent) { openingBalance += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { openingBalance += (t.type === 'CREDIT' ? t.amount : -t.amount); }
      });

      const contactTransactions = transactions
        .filter(t => t.contactId === contact.id)
        .filter(t => {
          const d = normalizeToLocalMidnight(t.date);
          return d >= start && d <= end;
        })
        .sort((a,b) => {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
          if (a.type === b.type) return 0;
          return a.type === 'CREDIT' ? -1 : 1;
        });
      
      let runningBal = openingBalance;
      const tableRows = contactTransactions.map(t => {
        if (isRent) { runningBal += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { runningBal += (t.type === 'CREDIT' ? t.amount : -t.amount); }
        const typeLabel = t.type === 'PAYMENT' ? (isRent ? 'Deposit' : 'Paid') : (isRent ? 'Withdraw' : 'Credit');
        return [t.date, t.description || '-', typeLabel, `LKR ${t.amount.toLocaleString()}`, `LKR ${runningBal.toLocaleString()}`];
      });

      tableRows.unshift([reportRange.start, 'Opening Balance', '-', '-', `LKR ${openingBalance.toLocaleString()}`]);

      const contactPendingChqs = transactions.filter(t => t.contactId === contact.id && isPendingCheque(t));
      const totalPendingAmount = contactPendingChqs.reduce((s, t) => s + t.amount, 0);
      const estBalIfPass = isRent ? runningBal + totalPendingAmount : runningBal - totalPendingAmount;

      const footRows = [['', '', 'TOTAL CLOSING BALANCE', '', `LKR ${runningBal.toLocaleString()}`]];
      if (contactPendingChqs.length > 0) {
        footRows.push(['', '', `CHEQUES ON HOLD (${contactPendingChqs.length} PENDING)`, '', `LKR ${totalPendingAmount.toLocaleString()}`]);
        footRows.push(['', '', 'IF PASS CHEQUE TOTAL BALANCE', '', `LKR ${Math.abs(estBalIfPass).toLocaleString()}`]);
      }

      autoTable(doc, {
        startY: 45,
        head: [['Date', 'Description', 'Type', 'Amount', 'Balance']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        foot: footRows,
        footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252] }
      });
      
      const safeName = contact.name.replace(/[^a-z0-9]/gi, '_');
      doc.save(`${safeName}_statement.pdf`);
      setIsReportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate statement.");
    }
  };

  const generateServicePDF = (contact: Contact, format: 'POS' | 'A4', action: 'download' | 'print' = 'download') => {
    try {
      const stats = contactStats[contact.id];
      const totalCost = stats?.totalCredit || contact.targetAmount || contact.totalCost || 0;
      
      const contactTransactions = transactions
        .filter(t => t.contactId === contact.id)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Service charges / costs added to this order
      const chargeTransactions = contactTransactions.filter(t => t.type === 'CREDIT');
      const chargesToRender = chargeTransactions.length > 0
        ? chargeTransactions.map(c => ({
            id: c.id,
            date: c.date,
            desc: c.description || 'Service Charge',
            amount: c.amount
          }))
        : ((contact.totalCost || contact.targetAmount || stats?.totalCredit || 0) > 0 ? [{
            id: 'init-cost',
            date: contact.orderDate || (contact.lastUpdated ? contact.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            desc: 'Device Service & Repair Charge',
            amount: contact.totalCost || contact.targetAmount || stats?.totalCredit || 0
          }] : []);

      const totalCalculatedCost = chargesToRender.reduce((sum, c) => sum + c.amount, 0) || totalCost;

      const paymentTransactions = contactTransactions.filter(t => t.type === 'PAYMENT');
      const paymentsToRender = paymentTransactions.length > 0
        ? paymentTransactions.map(p => ({
            id: p.id,
            date: p.date,
            desc: p.description || 'Payment Received',
            amount: p.amount
          }))
        : ((contact.advancePayment || 0) > 0 ? [{
            id: 'init-adv',
            date: contact.advanceDate || (contact.lastUpdated ? contact.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            desc: 'Advance Payment',
            amount: contact.advancePayment || 0
          }] : []);

      const totalPaid = paymentsToRender.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = totalCalculatedCost - totalPaid;
      const orderNo = `SO-${contact.id.slice(0, 6).toUpperCase()}`;
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (format === 'POS') {
        const dynamicHeight = Math.max(180, 140 + (chargesToRender.length * 6) + (paymentsToRender.length * 6) + 40);
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [80, dynamicHeight]
        });

        let y = 10;
        if (shopLogo && shopLogo.startsWith('data:image/')) {
          try {
            doc.addImage(shopLogo, 'PNG', 32, 6, 16, 16);
            y = 26;
          } catch (e) {
            console.error('Logo render error', e);
          }
        }
        doc.setFont('courier', 'bold');
        doc.setFontSize(13);
        doc.text(shopName.toUpperCase(), 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text(shopTagline.toUpperCase().slice(0, 36), 40, y, { align: 'center' });

        if (shopPhone || shopAddress) {
          y += 4;
          doc.text(`${shopPhone} • ${shopAddress}`.slice(0, 38), 40, y, { align: 'center' });
        }

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });

        y += 4;
        doc.setFont('courier', 'bold');
        doc.setFontSize(9);
        doc.text('SERVICE ORDER RECEIPT', 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text(`Order No : #${orderNo}`, 6, y);
        y += 4.5;
        doc.text(`Date     : ${dateStr} ${timeStr}`, 6, y);
        y += 4.5;
        doc.text(`Customer : ${contact.name}`, 6, y);
        y += 4.5;
        doc.text(`Phone    : ${contact.phone || '-'}`, 6, y);
        y += 4.5;
        doc.text(`Device   : ${contact.phoneModel || '-'}`, 6, y);
        y += 4.5;
        doc.text(`Status   : ${(contact.serviceStatus || 'Pending').toUpperCase()}`, 6, y);
        y += 4.5;
        const posItems = contact.collectedItems || [];
        const posItemsStr = posItems.length > 0 
          ? (posItems.join(', ') + (contact.otherCollectedItems ? `, ${contact.otherCollectedItems}` : ''))
          : (contact.otherCollectedItems || 'Device Only');
        doc.text(`Items In : ${posItemsStr.length > 34 ? posItemsStr.slice(0, 31) + '...' : posItemsStr}`, 6, y);

        // Section: Added Service Charges & Costs
        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.text('SERVICE CHARGES & COSTS', 40, y, { align: 'center' });
        y += 3.5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);

        if (chargesToRender.length === 0) {
          y += 3.5;
          doc.text('No charges recorded', 40, y, { align: 'center' });
        } else {
          chargesToRender.forEach(c => {
            y += 4.2;
            const cDate = formatDisplayDate(c.date);
            const desc = (c.desc || 'Service Charge').slice(0, 16);
            doc.text(`${cDate} ${desc}`, 6, y);
            doc.text(`LKR ${c.amount.toLocaleString()}`, 74, y, { align: 'right' });
          });
        }

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4.5;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.text('TOTAL SERVICE COST :', 6, y);
        doc.text(`LKR ${totalCalculatedCost.toLocaleString()}`, 74, y, { align: 'right' });

        // Section: Payment History
        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.text('PAYMENT HISTORY (WITH DATE)', 40, y, { align: 'center' });
        y += 3.5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);

        if (paymentsToRender.length === 0) {
          y += 3.5;
          doc.text('No payments recorded yet', 40, y, { align: 'center' });
        } else {
          paymentsToRender.forEach(p => {
            y += 4.2;
            const pDate = formatDisplayDate(p.date);
            const desc = (p.desc || 'Payment').slice(0, 16);
            doc.text(`${pDate} ${desc}`, 6, y);
            doc.text(`LKR ${p.amount.toLocaleString()}`, 74, y, { align: 'right' });
          });
        }

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4.5;
        doc.text('Total Paid to Date :', 6, y);
        doc.text(`LKR ${totalPaid.toLocaleString()}`, 74, y, { align: 'right' });

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        doc.text('BALANCE DUE  :', 6, y);
        doc.text(`LKR ${Math.abs(balanceDue).toLocaleString()}`, 74, y, { align: 'right' });

        y += 6;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4;
        doc.text('* Please present this receipt upon pickup', 40, y, { align: 'center' });
        y += 3.5;
        doc.text('* Repaired devices kept up to 30 days', 40, y, { align: 'center' });
        y += 4;
        doc.text('*** THANK YOU FOR YOUR BUSINESS! ***', 40, y, { align: 'center' });

        const safeName = `POS_${orderNo}_${contact.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        if (action === 'print') {
          doc.autoPrint();
          const blobUrl = doc.output('bloburl');
          window.open(blobUrl, '_blank');
        } else {
          doc.save(safeName);
        }
      } else {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Top Header
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(0, 0, 210, 28, 'F');

        let titleX = 14;
        if (shopLogo && shopLogo.startsWith('data:image/')) {
          try {
            doc.addImage(shopLogo, 'PNG', 12, 5, 18, 18);
            titleX = 35;
          } catch (e) {
            console.error('Logo render error', e);
          }
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(shopName.toUpperCase(), titleX, 14);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(shopTagline.toUpperCase(), titleX, 21);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`JOB NO: #${orderNo}`, 196, 15, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${dateStr}`, 196, 22, { align: 'right' });

        // Customer & Device Box
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer Information', 14, 38);
        doc.text('Device & Service Details', 115, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Customer Name : ${contact.name}`, 14, 46);
        doc.text(`Contact Phone : ${contact.phone || 'N/A'}`, 14, 53);
        doc.text(`Service Type  : Walk-in Repair Order`, 14, 60);

        const itemsArr = contact.collectedItems || [];
        const itemsStr = itemsArr.length > 0 
          ? (itemsArr.join(', ') + (contact.otherCollectedItems ? `, ${contact.otherCollectedItems}` : ''))
          : (contact.otherCollectedItems || 'Device Only');

        doc.text(`Phone Model   : ${contact.phoneModel || 'N/A'}`, 115, 46);
        doc.text(`Items Taken   : ${itemsStr.length > 38 ? itemsStr.slice(0, 35) + '...' : itemsStr}`, 115, 52);
        doc.text(`Repair Status : ${(contact.serviceStatus || 'Pending').toUpperCase()}`, 115, 58);
        doc.text(`Receipt Time  : ${timeStr}`, 115, 64);

        // Table 1: Service Charges Breakdown
        const chargeRows = chargesToRender.length > 0
          ? chargesToRender.map((c, idx) => [
              (idx + 1).toString(),
              formatDisplayDate(c.date),
              c.desc || 'Device Service & Repair Charge',
              contact.phoneModel || '-',
              `LKR ${c.amount.toLocaleString()}`
            ])
          : [['1', formatDisplayDate(contact.orderDate || new Date().toISOString().slice(0, 10)), 'Device Service & Repair Charge', contact.phoneModel || '-', `LKR ${totalCalculatedCost.toLocaleString()}`]];

        autoTable(doc, {
          startY: 72,
          head: [['#', 'Date', 'Charge / Item Description', 'Device / Model', 'Charge Amount (LKR)']],
          body: chargeRows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
          foot: [['', '', 'Total Service Cost', '', `LKR ${totalCalculatedCost.toLocaleString()}`]],
          footStyles: { fillColor: [241, 245, 249], textColor: [185, 28, 28], fontStyle: 'bold', halign: 'right' },
          styles: { fontSize: 9.5, cellPadding: 3.5 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 28 },
            2: { cellWidth: 74 },
            3: { cellWidth: 42 },
            4: { cellWidth: 40, halign: 'right' }
          }
        });

        const table1FinalY = (doc as any).lastAutoTable?.finalY || 85;

        // Payment History Section Heading
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Payment History & Receipts (With Dates)', 14, table1FinalY + 8);

        const paymentRows = paymentsToRender.length > 0
          ? paymentsToRender.map((p, idx) => [
              (idx + 1).toString(),
              formatDisplayDate(p.date),
              p.desc || 'Payment Received',
              'Confirmed',
              `LKR ${p.amount.toLocaleString()}`
            ])
          : [['-', '-', 'No payment records found', 'Pending', 'LKR 0']];

        // Table 2: Payment History
        autoTable(doc, {
          startY: table1FinalY + 11,
          head: [['#', 'Payment Date', 'Payment Description / Note', 'Status', 'Amount Paid (LKR)']],
          body: paymentRows,
          theme: 'striped',
          headStyles: { fillColor: [15, 118, 110], fontStyle: 'bold' },
          foot: [['', '', 'Total Paid to Date', '', `LKR ${totalPaid.toLocaleString()}`]],
          footStyles: { fillColor: [241, 245, 249], textColor: [21, 128, 61], fontStyle: 'bold', halign: 'right' },
          styles: { fontSize: 9.5, cellPadding: 3.5 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 32 },
            2: { cellWidth: 78 },
            3: { cellWidth: 34 },
            4: { cellWidth: 40, halign: 'right' }
          }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || (table1FinalY + 35);

        // Balance Summary Box
        const boxY = finalY + 8;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(120, boxY, 76, 32, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(120, boxY, 76, 32, 2, 2, 'D');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Service Cost:', 125, boxY + 8);
        doc.text(`LKR ${totalCalculatedCost.toLocaleString()}`, 190, boxY + 8, { align: 'right' });

        doc.text('Total Paid to Date:', 125, boxY + 15);
        doc.text(`LKR ${totalPaid.toLocaleString()}`, 190, boxY + 15, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(balanceDue > 0 ? 185 : 21, balanceDue > 0 ? 28 : 128, balanceDue > 0 ? 28 : 61);
        doc.text('BALANCE DUE:', 125, boxY + 25);
        doc.text(`LKR ${Math.abs(balanceDue).toLocaleString()}`, 190, boxY + 25, { align: 'right' });

        // Terms and Signatures
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('TERMS & CONDITIONS:', 14, boxY + 45);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Please produce this receipt when collecting your repaired device.', 14, boxY + 51);
        doc.text('2. Repaired items not claimed within 30 days are subject to storage charges.', 14, boxY + 56);
        doc.text('3. Warranty applies exclusively to parts replaced during this repair.', 14, boxY + 61);

        doc.setDrawColor(203, 213, 225);
        doc.line(14, boxY + 85, 75, boxY + 85);
        doc.text('Customer Signature', 14, boxY + 90);

        doc.line(135, boxY + 85, 196, boxY + 85);
        doc.text('Authorized Store Signature', 135, boxY + 90);

        const safeName = `Invoice_${orderNo}_${contact.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        if (action === 'print') {
          doc.autoPrint();
          const blobUrl = doc.output('bloburl');
          window.open(blobUrl, '_blank');
        } else {
          doc.save(safeName);
        }
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const openPreview = (contact: Contact, initialFormat: 'POS' | 'A4' = 'POS') => {
    setPreviewServiceOrder(contact);
    setPreviewFormat(initialFormat);
    setIsPreviewModalOpen(true);
    setPrintMenuContactId(null);
  };

  const handleEditServiceOrder = (contact: Contact) => {
    setEditingContact(contact);
    setAddName(contact.name);
    setAddPhone(contact.phone || '');
    setAddPhoneModel(contact.phoneModel || '');
    const stats = contactStats[contact.id];
    const cost = contact.totalCost || contact.targetAmount || stats?.totalCredit || '';
    const adv = contact.advancePayment || stats?.totalPayment || '';
    setAddTotalCost(cost ? cost.toString() : '');
    setAddAdvancePayment(adv ? adv.toString() : '');
    setAddServiceStatus(contact.serviceStatus || 'Pending');
    setTargetAmount(contact.targetAmount?.toString() || '30000');

    const costTx = transactions.find(t => t.contactId === contact.id && t.description === 'Service Total Cost');
    setAddOrderDate(costTx?.date || contact.orderDate || new Date().toISOString().slice(0, 10));

    const advTx = transactions.find(t => t.contactId === contact.id && t.description === 'Advance Payment');
    setAddAdvanceDate(advTx?.date || contact.advanceDate || new Date().toISOString().slice(0, 10));

    setAddCollectedItems(contact.collectedItems || []);
    setAddOtherCollectedItems(contact.otherCollectedItems || '');

    navigateTo('CONTACT_FORM');
  };

  const renderPreviewModal = () => {
    if (!isPreviewModalOpen || !previewServiceOrder) return null;
    const stats = contactStats[previewServiceOrder.id];
    const totalCost = stats?.totalCredit || previewServiceOrder.targetAmount || previewServiceOrder.totalCost || 0;
    
    const contactTransactions = transactions
      .filter(t => t.contactId === previewServiceOrder.id)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Service charges / costs added to this order
    const chargeTransactions = contactTransactions.filter(t => t.type === 'CREDIT');
    const chargesToRender = chargeTransactions.length > 0
      ? chargeTransactions.map(c => ({
          id: c.id,
          date: c.date,
          desc: c.description || 'Service Charge',
          amount: c.amount
        }))
      : ((previewServiceOrder.totalCost || previewServiceOrder.targetAmount || stats?.totalCredit || 0) > 0 ? [{
          id: 'init-cost',
          date: previewServiceOrder.orderDate || (previewServiceOrder.lastUpdated ? previewServiceOrder.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          desc: 'Device Service & Repair Charge',
          amount: previewServiceOrder.totalCost || previewServiceOrder.targetAmount || stats?.totalCredit || 0
        }] : []);

    const totalCalculatedCost = chargesToRender.reduce((sum, c) => sum + c.amount, 0) || totalCost;

    const paymentTransactions = contactTransactions.filter(t => t.type === 'PAYMENT');
    const paymentsToRender = paymentTransactions.length > 0
      ? paymentTransactions.map(p => ({
          id: p.id,
          date: p.date,
          desc: p.description || 'Payment Received',
          amount: p.amount
        }))
      : ((previewServiceOrder.advancePayment || 0) > 0 ? [{
          id: 'init-adv',
          date: previewServiceOrder.advanceDate || (previewServiceOrder.lastUpdated ? previewServiceOrder.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          desc: 'Advance Payment',
          amount: previewServiceOrder.advancePayment || 0
        }] : []);

    const totalPaid = paymentsToRender.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalCalculatedCost - totalPaid;
    const orderNo = `SO-${previewServiceOrder.id.slice(0, 6).toUpperCase()}`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-slate-100 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-slate-200">
          {/* Header */}
          <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">Service Order Preview</h3>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                  #{orderNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{previewServiceOrder.name} • {previewServiceOrder.phoneModel || 'Device'}</p>
            </div>
            <button 
              onClick={() => setIsPreviewModalOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Format Switcher Tabs */}
          <div className="bg-white px-5 py-2.5 border-b border-slate-200 flex gap-2 shrink-0">
            <button
              onClick={() => setPreviewFormat('POS')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                previewFormat === 'POS'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt size={15} /> POS Thermal (80mm)
            </button>
            <button
              onClick={() => setPreviewFormat('A4')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                previewFormat === 'A4'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText size={15} /> A4 Invoice PDF
            </button>
          </div>

          {/* Scrollable Preview Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-200/70">
            {previewFormat === 'POS' ? (
              /* POS 80mm Receipt Style */
              <div className="w-full max-w-[340px] bg-white rounded-xl shadow-lg border border-slate-300 p-5 font-mono text-[13px] leading-relaxed relative text-slate-800">
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  {shopLogo && (
                    <img src={shopLogo} alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2 rounded-lg" />
                  )}
                  <h4 className="font-black text-base tracking-wider uppercase text-slate-900">{shopName}</h4>
                  <p className="text-[10px] text-slate-500 font-bold tracking-tight uppercase mt-0.5">{shopTagline}</p>
                  {(shopPhone || shopAddress) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{shopPhone} • {shopAddress}</p>
                  )}
                  <div className="mt-2 text-center inline-block bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-700 tracking-wider">
                    SERVICE ORDER #{orderNo}
                  </div>
                </div>

                <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Date/Time:</span><span className="font-semibold">{dateStr} {timeStr}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Customer:</span><span className="font-bold text-slate-900">{previewServiceOrder.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span>{previewServiceOrder.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Device:</span><span className="font-bold text-indigo-700">{previewServiceOrder.phoneModel || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">Status:</span>
                    <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                      {previewServiceOrder.serviceStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-dotted border-slate-300">
                    <span className="text-slate-500 text-[11px] font-bold block mb-0.5">Items Collected:</span>
                    <span className="font-bold text-slate-800 text-[11px] block bg-slate-50 p-1.5 rounded border border-slate-200/80">
                      {previewServiceOrder.collectedItems && previewServiceOrder.collectedItems.length > 0
                        ? previewServiceOrder.collectedItems.join(', ') + (previewServiceOrder.otherCollectedItems ? `, ${previewServiceOrder.otherCollectedItems}` : '')
                        : (previewServiceOrder.otherCollectedItems || 'Device Only')}
                    </span>
                  </div>
                </div>

                <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
                  {/* Itemized Service Charges & Costs */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Service Charges & Costs</span>
                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{chargesToRender.length} item(s)</span>
                    </p>
                    {chargesToRender.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic text-center py-1">No service charges recorded</p>
                    ) : (
                      <div className="space-y-1">
                        {chargesToRender.map((c, idx) => (
                          <div key={idx} className="flex justify-between items-start text-[11px]">
                            <span className="text-slate-600 font-medium truncate max-w-[190px]">
                              {formatDisplayDate(c.date)} • {c.desc}
                            </span>
                            <span className="font-bold text-slate-800 ml-1 shrink-0">LKR {c.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-slate-200 mt-2 pt-1.5 flex justify-between text-xs font-bold text-slate-800">
                      <span>Total Service Cost:</span>
                      <span className="text-red-600">LKR {totalCalculatedCost.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Payment History */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Payment History (With Date)</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{paymentsToRender.length} payment(s)</span>
                    </p>
                    {paymentsToRender.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic text-center py-1">No payments recorded yet</p>
                    ) : (
                      <div className="space-y-1">
                        {paymentsToRender.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-start text-[11px]">
                            <span className="text-slate-600 font-medium truncate max-w-[190px]">{formatDisplayDate(p.date)} • {p.desc}</span>
                            <span className="font-bold text-green-700 ml-1 shrink-0">LKR {p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-slate-300 flex justify-between text-xs font-semibold text-slate-600">
                  <span>Total Paid to Date:</span>
                  <span className="font-bold text-green-700">LKR {totalPaid.toLocaleString()}</span>
                </div>

                <div className="py-3 bg-slate-50 rounded-lg px-3 my-2 border border-slate-200 flex justify-between items-center">
                  <span className="font-black text-xs uppercase text-slate-700">BALANCE DUE:</span>
                  <span className="font-black text-base text-red-700">LKR {Math.abs(balanceDue).toLocaleString()}</span>
                </div>

                <div className="pt-2 text-center text-[10px] text-slate-400 space-y-1 font-sans">
                  <p>• Please present this receipt upon pickup</p>
                  <p>• Repaired devices kept up to 30 days</p>
                  <p className="font-bold text-slate-600 mt-2">*** THANK YOU FOR YOUR BUSINESS! ***</p>
                </div>
              </div>
            ) : (
              /* A4 Invoice Style */
              <div className="w-full bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden text-slate-800">
                {/* A4 Header Banner */}
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {shopLogo ? (
                      <img src={shopLogo} alt="Logo" className="w-12 h-12 object-cover rounded-xl border border-white/20 bg-white" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xl border border-white/20">
                        {shopName[0] || 'S'}
                      </div>
                    )}
                    <div>
                      <h4 className="text-lg font-black tracking-wide uppercase">{shopName}</h4>
                      <p className="text-[11px] text-slate-300 font-medium tracking-wide">{shopTagline}</p>
                      {(shopPhone || shopAddress) && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{shopPhone} • {shopAddress}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded uppercase">JOB #{orderNo}</div>
                    <p className="text-[11px] text-slate-400 mt-1">Date: {dateStr}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Two columns */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer Details</p>
                      <p className="font-bold text-sm text-slate-900">{previewServiceOrder.name}</p>
                      <p className="text-slate-600 mt-0.5">{previewServiceOrder.phone || 'No phone'}</p>
                      <p className="text-slate-400 text-[11px] mt-1">Walk-in Repair Order</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Device Details</p>
                      <p className="font-bold text-sm text-indigo-700">{previewServiceOrder.phoneModel || 'Device'}</p>
                      <p className="text-slate-600 mt-0.5 font-semibold">Status: <span className="uppercase text-slate-800">{previewServiceOrder.serviceStatus || 'Pending'}</span></p>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[11px]">
                        <span className="font-bold text-slate-500">Items Received: </span>
                        <span className="font-bold text-slate-800">
                          {previewServiceOrder.collectedItems && previewServiceOrder.collectedItems.length > 0
                            ? previewServiceOrder.collectedItems.join(', ') + (previewServiceOrder.otherCollectedItems ? `, ${previewServiceOrder.otherCollectedItems}` : '')
                            : (previewServiceOrder.otherCollectedItems || 'Device Only')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table 1: Service Charges & Costs */}
                  <div>
                    <h5 className="font-bold text-xs text-slate-700 mb-2 flex items-center justify-between">
                      <span>Service Charges & Costs (Itemized)</span>
                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{chargesToRender.length} item(s)</span>
                    </h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-800 text-white font-bold">
                          <tr>
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Item Description</th>
                            <th className="p-2.5">Device</th>
                            <th className="p-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {chargesToRender.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-3 text-center text-slate-400 italic">No charges recorded yet</td>
                            </tr>
                          ) : (
                            chargesToRender.map((c, idx) => (
                              <tr key={idx}>
                                <td className="p-2.5 text-slate-400">{idx + 1}</td>
                                <td className="p-2.5 text-slate-600">{formatDisplayDate(c.date)}</td>
                                <td className="p-2.5 font-medium text-slate-800">{c.desc}</td>
                                <td className="p-2.5 text-slate-600">{previewServiceOrder.phoneModel || '-'}</td>
                                <td className="p-2.5 text-right font-bold text-slate-900">LKR {c.amount.toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                          <tr>
                            <td colSpan={4} className="p-2.5 text-right text-xs">Total Service Cost:</td>
                            <td className="p-2.5 text-right text-xs text-red-600">LKR {totalCalculatedCost.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Table 2: Payment History With Dates */}
                  <div>
                    <h5 className="font-bold text-xs text-slate-700 mb-2 flex items-center justify-between">
                      <span>Payment History & Receipts (With Dates)</span>
                      <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">{paymentsToRender.length} recorded</span>
                    </h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-teal-700 text-white font-bold">
                          <tr>
                            <th className="p-2">#</th>
                            <th className="p-2">Payment Date</th>
                            <th className="p-2">Description / Note</th>
                            <th className="p-2 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paymentsToRender.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-slate-400 italic">No payments recorded yet</td>
                            </tr>
                          ) : (
                            paymentsToRender.map((p, idx) => (
                              <tr key={idx}>
                                <td className="p-2 text-slate-400">{idx + 1}</td>
                                <td className="p-2 font-semibold text-slate-800">{formatDisplayDate(p.date)}</td>
                                <td className="p-2 text-slate-600">{p.desc}</td>
                                <td className="p-2 text-right font-bold text-green-600">LKR {p.amount.toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex justify-end">
                    <div className="w-60 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Service Cost:</span>
                        <span className="font-bold text-slate-900">LKR {totalCalculatedCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Paid to Date:</span>
                        <span className="font-bold text-green-700">LKR {totalPaid.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                        <span className="font-black text-slate-800">BALANCE DUE:</span>
                        <span className="font-black text-sm text-red-600">LKR {Math.abs(balanceDue).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 space-y-0.5">
                    <p className="font-bold text-slate-500 uppercase">Terms & Conditions:</p>
                    <p>1. Please present this receipt upon pickup.</p>
                    <p>2. Repaired items not claimed within 30 days are subject to storage charges.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="bg-white p-4 border-t border-slate-200 flex flex-wrap gap-2.5 shrink-0 justify-between items-center">
            <button
              onClick={() => generateServicePDF(previewServiceOrder, 'POS')}
              className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={14} /> Download POS (80mm)
            </button>
            <button
              onClick={() => generateServicePDF(previewServiceOrder, 'A4')}
              className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={14} /> Download A4 PDF
            </button>
            <button
              onClick={() => generateServicePDF(previewServiceOrder, previewFormat, 'print')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              title="Print document"
            >
              <Printer size={15} /> Print {previewFormat}
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state) { 
        setCurrentView('DASHBOARD'); 
        setSelectedContact(null); 
        setIsReportModalOpen(false);
        return; 
      }
      setCurrentView(state.view || 'DASHBOARD');
      if (state.tab) setActiveTab(state.tab);
      if (state.contactId) {
        const c = contactsRef.current.find(con => con.id === state.contactId);
        setSelectedContact(c || null);
      } else { 
        setSelectedContact(null); 
      }
      setIsReportModalOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: string, contactId: string | null = null) => {
    let hash = `#${view.toLowerCase()}`;
    if (contactId) hash += `/${contactId}`;
    window.history.pushState({ view, contactId, tab: activeTab }, '', hash);
    setCurrentView(view);
  };

  const fetchData = async (targetUserId?: string) => {
    const activeUid = targetUserId || authUser?.id;
    if (!activeUid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setDbStatus('checking');
    try {
      const [contactsRes, transRes, cashbookRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', activeUid),
        supabase.from('transactions').select('*').eq('user_id', activeUid).order('date', { ascending: false }),
        supabase.from('cashbook_entries').select('*').eq('user_id', activeUid).order('date', { ascending: false })
      ]);

      if (contactsRes.error) {
        console.warn('Supabase contacts query status:', contactsRes.error);
        if (
          contactsRes.error.code === 'PGRST205' || 
          contactsRes.error.message?.includes('schema cache') || 
          contactsRes.error.message?.includes('not find')
        ) {
          setDbStatus('needs_tables');
        } else {
          setDbStatus('error');
        }
      } else {
        setDbStatus('connected');
      }

      let mappedContacts: Contact[] = [];
      let mappedTx: Transaction[] = [];
      let mappedCb: CashbookEntry[] = [];

      if (contactsRes.data) {
        mappedContacts = contactsRes.data.map((c: any) => {
          let parsedStatus = 'Pending';
          let parsedAdvance = 0;
          let parsedAdvDate = '';
          let parsedOrderDate = '';
          let parsedCollectedItems: string[] = [];
          let parsedOtherCollectedItems = '';
          if (c.end_date) {
            try {
              if (c.end_date.startsWith('{')) {
                const parsed = JSON.parse(c.end_date);
                parsedStatus = parsed.status || 'Pending';
                parsedAdvance = parsed.advance || 0;
                parsedAdvDate = parsed.advanceDate || '';
                parsedOrderDate = parsed.orderDate || '';
                parsedCollectedItems = Array.isArray(parsed.collectedItems) ? parsed.collectedItems : [];
                parsedOtherCollectedItems = parsed.otherCollectedItems || '';
              } else {
                parsedStatus = c.end_date;
              }
            } catch {
              parsedStatus = c.end_date;
            }
          }
          return {
            id: c.id, 
            userId: c.user_id,
            name: c.name, 
            phone: c.phone || '', 
            type: c.type === 'SUPPLIER' ? 'VENDOR' : c.type,
            balance: c.balance || 0, 
            targetAmount: c.target_amount,
            phoneModel: c.start_date || '',
            serviceStatus: parsedStatus,
            totalCost: c.target_amount || 0,
            advancePayment: parsedAdvance,
            advanceDate: parsedAdvDate,
            orderDate: parsedOrderDate,
            collectedItems: parsedCollectedItems,
            otherCollectedItems: parsedOtherCollectedItems,
            lastUpdated: c.last_updated
          };
        });
        setContacts(mappedContacts);
        try { 
          localStorage.setItem(`st_cached_contacts_${activeUid}`, JSON.stringify(mappedContacts));
          localStorage.setItem('st_cached_contacts', JSON.stringify(mappedContacts)); 
        } catch {}
      }

      if (transRes.data) {
        mappedTx = transRes.data.map((t: any) => ({
          id: t.id, 
          userId: t.user_id,
          contactId: t.contact_id, 
          date: t.date, 
          description: t.description,
          amount: t.amount, 
          type: t.type, 
          balanceAfter: t.balance_after
        }));
        setTransactions(mappedTx);
        try { 
          localStorage.setItem(`st_cached_transactions_${activeUid}`, JSON.stringify(mappedTx));
          localStorage.setItem('st_cached_transactions', JSON.stringify(mappedTx)); 
        } catch {}
      }

      if (cashbookRes.data) {
        mappedCb = cashbookRes.data.map((c: any) => {
          let cbType: CashbookEntryType = (c.type === 'EXPENSE' ? 'EXPENSE' : 'SALE');
          if (c.category === 'Shop Rent' && c.description?.toLowerCase().includes('withdrawal')) {
            cbType = 'SALE';
          }
          return {
            id: c.id,
            userId: c.user_id,
            type: cbType,
            amount: Number(c.amount) || 0,
            date: c.date,
            category: c.category || 'General',
            description: c.description || '',
            paymentMethod: (c.payment_method || 'Cash') as PaymentMethod,
            referenceNo: c.reference_no || '',
            contactName: c.contact_name || '',
            createdAt: c.created_at
          };
        });

        // Auto-link any customer (Sales), vendor (Expenses), rent deposits (Expenses) / rent withdrawals (Sales), or service (Sales) payments if missing in Cashbook
        const existingCbIds = new Set(mappedCb.map(c => c.id));
        const allContactsMap = new Map(mappedContacts.map(c => [c.id, c]));
        const missingCbEntries: CashbookEntry[] = [];

        for (const tx of mappedTx) {
          if (!allContactsMap.has(tx.contactId) || existingCbIds.has(tx.id) || !tx.amount || tx.amount <= 0) continue;
          const contact = allContactsMap.get(tx.contactId)!;
          const shouldAutoSync = tx.type === 'PAYMENT' || (contact.type === 'RENT' && tx.type === 'CREDIT');

          if (shouldAutoSync) {
            const parsed = parsePaymentMethod(tx.description);
            const method = (tx.paymentMethod || parsed.method || 'Cash') as PaymentMethod;
            const parsedDesc = parsed.cleanNotes || tx.description || 'Payment';

            let entryType: CashbookEntryType = 'SALE';
            let category = 'Customer Payment';
            let refNo = `CUST-${contact.id.slice(0, 6).toUpperCase()}`;
            let desc = `Customer Payment - ${contact.name}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;

            if (contact.type === 'CUSTOMER') {
              entryType = 'SALE';
              category = 'Customer Payment';
              refNo = `CUST-${contact.id.slice(0, 6).toUpperCase()}`;
              desc = `Payment Received - ${contact.name}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;
            } else if (contact.type === 'VENDOR') {
              entryType = 'EXPENSE';
              category = 'Vendor Payment';
              refNo = `VEND-${contact.id.slice(0, 6).toUpperCase()}`;
              desc = `Payment to Vendor - ${contact.name}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;
            } else if (contact.type === 'RENT') {
              if (tx.type === 'CREDIT') {
                entryType = 'SALE';
                category = 'Shop Rent';
                refNo = `RENT-${contact.id.slice(0, 6).toUpperCase()}`;
                desc = `Rent Withdrawal - ${contact.name}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;
              } else {
                entryType = 'EXPENSE';
                category = 'Shop Rent';
                refNo = `RENT-${contact.id.slice(0, 6).toUpperCase()}`;
                desc = `Rent Deposit / Payment - ${contact.name}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;
              }
            } else if (contact.type === 'SERVICE') {
              entryType = 'SALE';
              category = 'Repair Charges';
              refNo = `SO-${contact.id.slice(0, 6).toUpperCase()}`;
              const isAdv = parsedDesc.toLowerCase().includes('advance');
              desc = isAdv
                ? `Advance Payment - ${contact.phoneModel || 'Device Repair'}`
                : `Service Payment - ${contact.phoneModel || 'Device Repair'}${parsedDesc ? ' (' + parsedDesc + ')' : ''}`;
            }

            const newCb: CashbookEntry = {
              id: tx.id,
              userId: activeUid,
              type: entryType,
              amount: tx.amount,
              date: tx.date,
              category: category,
              description: desc,
              paymentMethod: method,
              referenceNo: refNo,
              contactName: contact.name,
              createdAt: new Date().toISOString()
            };
            missingCbEntries.push(newCb);
            existingCbIds.add(tx.id);
          }
        }

        if (missingCbEntries.length > 0) {
          try {
            const payloads = missingCbEntries.map(e => ({
              id: e.id,
              user_id: activeUid,
              type: e.type,
              amount: e.amount,
              date: e.date,
              category: e.category,
              description: e.description,
              payment_method: e.paymentMethod,
              reference_no: e.referenceNo,
              contact_name: e.contactName
            }));
            await supabase.from('cashbook_entries').insert(payloads);
          } catch (e) {
            console.warn('Auto-sync missing service payments:', e);
          }
          mappedCb.unshift(...missingCbEntries);
        }

        setCashbookEntries(mappedCb);
        try { 
          localStorage.setItem(`st_cashbook_entries_${activeUid}`, JSON.stringify(mappedCb));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(mappedCb)); 
        } catch {}
      }
    } catch (err: any) { 
      console.error(err); 
      setDbStatus('error');
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setAuthSession(session);
        setAuthUser(session?.user || null);

        if (session?.user) {
          if (session.user.email_confirmed_at) {
            setIsAuthenticated(true);
            sessionStorage.setItem('st_auth_active', 'true');
          }

          const prof = await loadUserProfile(session.user.id, session.user.user_metadata);
          if (mounted) {
            setUserProfile(prof);
            setShopName(prof?.shopName || '');
            setShopTagline(prof?.tagline || 'Mobile Phone Repair & Service');
            setShopPhone(prof?.phone || '');
            setShopAddress(prof?.address || '');
            setShopLogo(prof?.logoUrl || null);
          }

          await fetchData(session.user.id);
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setAuthSession(session);
      setAuthUser(session?.user || null);

      if (session?.user) {
        if (session.user.email_confirmed_at) {
          setIsAuthenticated(true);
          sessionStorage.setItem('st_auth_active', 'true');
        }

        const prof = await loadUserProfile(session.user.id, session.user.user_metadata);
        if (mounted) {
          setUserProfile(prof);
          setShopName(prof?.shopName || '');
          setShopTagline(prof?.tagline || 'Mobile Phone Repair & Service');
          setShopPhone(prof?.phone || '');
          setShopAddress(prof?.address || '');
          setShopLogo(prof?.logoUrl || null);
        }

        await fetchData(session.user.id);
      } else {
        setUserProfile(null);
        setShopName('');
        setShopPhone('');
        setShopAddress('');
        setShopLogo(null);
        setShopTagline('Mobile Phone Repair & Service');
        setContacts([]);
        setTransactions([]);
        setCashbookEntries([]);
        setIsAuthenticated(false);
        sessionStorage.removeItem('st_auth_active');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleBack = () => { window.history.back(); };

  // Helper: Automatically link Customer payments to Sales, Vendor payments to Expenses, Rent deposits to Expenses / withdrawals to Sales, and Service payments to Sales
  const recordOrUpdateLinkedCashbookEntry = async (params: {
    txId: string;
    contactId: string;
    contactName: string;
    contactType: ContactType;
    txType?: TransactionType;
    phoneModel?: string;
    amount: number;
    date: string;
    paymentMethod?: string;
    descriptionNote?: string;
    isAdvance?: boolean;
  }) => {
    if (!params.amount || params.amount <= 0) return;
    const method = (params.paymentMethod || 'Cash') as PaymentMethod;

    let entryType: CashbookEntryType = 'SALE';
    let category = 'Customer Payment';
    let refPrefix = 'CUST';
    let desc = '';

    if (params.contactType === 'CUSTOMER') {
      entryType = 'SALE';
      category = 'Customer Payment';
      refPrefix = 'CUST';
      desc = `Payment Received - ${params.contactName}${params.descriptionNote ? ' (' + params.descriptionNote + ')' : ''}`;
    } else if (params.contactType === 'VENDOR') {
      entryType = 'EXPENSE';
      category = 'Vendor Payment';
      refPrefix = 'VEND';
      desc = `Payment to Vendor - ${params.contactName}${params.descriptionNote ? ' (' + params.descriptionNote + ')' : ''}`;
    } else if (params.contactType === 'RENT') {
      if (params.txType === 'CREDIT') {
        entryType = 'SALE';
        category = 'Shop Rent';
        refPrefix = 'RENT';
        desc = `Rent Withdrawal - ${params.contactName}${params.descriptionNote ? ' (' + params.descriptionNote + ')' : ''}`;
      } else {
        entryType = 'EXPENSE';
        category = 'Shop Rent';
        refPrefix = 'RENT';
        desc = `Rent Deposit / Payment - ${params.contactName}${params.descriptionNote ? ' (' + params.descriptionNote + ')' : ''}`;
      }
    } else if (params.contactType === 'SERVICE') {
      entryType = 'SALE';
      category = 'Repair Charges';
      refPrefix = 'SO';
      const descPrefix = params.isAdvance ? 'Advance Payment' : 'Service Payment';
      const modelText = params.phoneModel ? ` - ${params.phoneModel}` : '';
      const noteText = params.descriptionNote ? ` (${params.descriptionNote})` : '';
      desc = `${descPrefix}${modelText}${noteText}`;
    }

    const orderNo = `${refPrefix}-${params.contactId.slice(0, 6).toUpperCase()}`;

    const entryPayload = {
      id: params.txId,
      user_id: authUser?.id,
      type: entryType,
      amount: params.amount,
      date: params.date,
      category: category,
      description: desc,
      payment_method: method,
      reference_no: orderNo,
      contact_name: params.contactName
    };

    const newEntry: CashbookEntry = {
      id: params.txId,
      userId: authUser?.id,
      type: entryType,
      amount: params.amount,
      date: params.date,
      category: category,
      description: desc,
      paymentMethod: method,
      referenceNo: orderNo,
      contactName: params.contactName,
      createdAt: new Date().toISOString()
    };

    // 1. Supabase upsert / insert / update
    try {
      const { data: existing } = await supabase.from('cashbook_entries').select('id').eq('id', params.txId).maybeSingle();
      if (existing) {
        let q = supabase.from('cashbook_entries').update({
          type: entryType,
          amount: params.amount,
          date: params.date,
          category: category,
          description: desc,
          payment_method: method,
          contact_name: params.contactName,
          reference_no: orderNo
        }).eq('id', params.txId);
        if (authUser?.id) q = q.eq('user_id', authUser.id);
        await q;
      } else {
        await supabase.from('cashbook_entries').insert([entryPayload]);
      }
    } catch (err) {
      console.warn('Supabase cashbook sync warning:', err);
    }

    // 2. React state & Local Storage update
    setCashbookEntries(prev => {
      const exists = prev.some(e => e.id === params.txId);
      const next = exists
        ? prev.map(e => e.id === params.txId ? { ...e, ...newEntry } : e)
        : [newEntry, ...prev];
      try {
        const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
        localStorage.setItem(cacheKey, JSON.stringify(next));
        localStorage.setItem('st_cashbook_entries', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeLinkedCashbookEntry = async (txId: string) => {
    try {
      let q = supabase.from('cashbook_entries').delete().eq('id', txId);
      if (authUser?.id) q = q.eq('user_id', authUser.id);
      await q;
    } catch (err) {
      console.warn('Supabase cashbook delete warning:', err);
    }

    setCashbookEntries(prev => {
      const next = prev.filter(e => e.id !== txId);
      try {
        const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
        localStorage.setItem(cacheKey, JSON.stringify(next));
        localStorage.setItem('st_cashbook_entries', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const recordOrUpdateServicePaymentInCashbook = (params: any) =>
    recordOrUpdateLinkedCashbookEntry({ ...params, contactType: 'SERVICE' });
  const removeServicePaymentFromCashbook = removeLinkedCashbookEntry;

  const handleSaveContact = async () => {
    if (!addName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const isService = editingContact ? editingContact.type === 'SERVICE' : activeTab === 'SERVICE';
      const costVal = isService ? (parseFloat(addTotalCost) || 0) : null;
      const advanceVal = isService ? (parseFloat(addAdvancePayment) || 0) : null;
      const effectiveOrderDate = addOrderDate || new Date().toISOString().slice(0, 10);
      const effectiveAdvDate = addAdvanceDate || new Date().toISOString().slice(0, 10);

      const payload: any = { 
        user_id: authUser?.id,
        name: addName.trim(), 
        phone: addPhone.trim(),
        type: isService ? 'SERVICE' : activeTab, 
        target_amount: isService ? costVal : (activeTab === 'RENT' ? (parseFloat(targetAmount) || 30000) : null), 
        start_date: isService ? addPhoneModel.trim() : null,
        end_date: isService ? JSON.stringify({ 
          status: addServiceStatus, 
          advance: advanceVal || 0,
          advanceDate: effectiveAdvDate,
          orderDate: effectiveOrderDate,
          collectedItems: addCollectedItems,
          otherCollectedItems: addOtherCollectedItems.trim()
        }) : null,
        last_updated: new Date().toISOString() 
      };
      
      let res;
      let contactId = editingContact?.id;
      if (editingContact) {
        let q = supabase.from('contacts').update(payload).eq('id', editingContact.id);
        if (authUser?.id) q = q.eq('user_id', authUser.id);
        res = await q.select();
      } else {
        const newId = generateUUID();
        contactId = newId;
        res = await supabase.from('contacts').insert([{ ...payload, id: newId, balance: 0 }]).select();
      }

      if (res.error) {
        if (res.error.code === 'PGRST205' || res.error.message?.includes('schema cache') || res.error.message?.includes('not find')) {
          setDbStatus('needs_tables');
          const fallbackContact: Contact = {
            id: contactId || generateUUID(),
            userId: authUser?.id,
            name: addName.trim(), 
            phone: addPhone.trim(),
            type: isService ? 'SERVICE' : activeTab,
            balance: 0,
            targetAmount: isService ? costVal : (activeTab === 'RENT' ? (parseFloat(targetAmount) || 30000) : null),
            phoneModel: isService ? addPhoneModel.trim() : '',
            serviceStatus: addServiceStatus,
            totalCost: costVal || 0,
            advancePayment: advanceVal || 0,
            advanceDate: effectiveAdvDate,
            orderDate: effectiveOrderDate,
            collectedItems: isService ? addCollectedItems : undefined,
            otherCollectedItems: isService ? addOtherCollectedItems.trim() : undefined,
            lastUpdated: new Date().toISOString()
          };
          if (editingContact) {
            setContacts(prev => prev.map(c => c.id === editingContact.id ? fallbackContact : c));
          } else {
            setContacts(prev => [...prev, fallbackContact]);
          }
          try {
            const cacheKey = authUser?.id ? `st_cached_contacts_${authUser.id}` : 'st_cached_contacts';
            const currentCache = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const nextCache = editingContact 
              ? currentCache.map((c: any) => c.id === editingContact.id ? fallbackContact : c)
              : [...currentCache, fallbackContact];
            localStorage.setItem(cacheKey, JSON.stringify(nextCache));
            localStorage.setItem('st_cached_contacts', JSON.stringify(nextCache));
          } catch {}
          showProfileToast("Saved locally! Run Supabase SQL setup to sync to cloud.", "error");
          setAddName(''); 
          setAddPhone(''); 
          setAddPhoneModel('');
          setAddTotalCost('');
          setAddAdvancePayment('');
          setAddOrderDate(new Date().toISOString().slice(0, 10));
          setAddAdvanceDate(new Date().toISOString().slice(0, 10));
          setAddServiceStatus('Pending');
          setAddCollectedItems([]);
          setAddOtherCollectedItems('');
          setTargetAmount('30000'); 
          setEditingContact(null);
          handleBack();
          return;
        }
        throw res.error;
      }
      
      if (res.data) {
        const savedData = res.data[0];
        const updatedContact: Contact = {
          id: savedData.id,
          userId: savedData.user_id,
          name: savedData.name,
          phone: savedData.phone || '',
          type: savedData.type === 'SUPPLIER' ? 'VENDOR' : savedData.type,
          balance: savedData.balance || 0,
          targetAmount: savedData.target_amount,
          phoneModel: savedData.start_date || '',
          serviceStatus: addServiceStatus,
          totalCost: costVal || 0,
          advancePayment: advanceVal || 0,
          advanceDate: effectiveAdvDate,
          orderDate: effectiveOrderDate,
          collectedItems: isService ? addCollectedItems : undefined,
          otherCollectedItems: isService ? addOtherCollectedItems.trim() : undefined,
          lastUpdated: savedData.last_updated
        };

        // If it is a new SERVICE order, automatically record transactions for Total Cost & Advance Payment with explicit dates!
        if (isService && contactId && !editingContact) {
          const newTxList: Transaction[] = [];

          if (costVal && costVal > 0) {
            const costTx = {
              user_id: authUser?.id,
              contact_id: contactId,
              date: effectiveOrderDate,
              amount: costVal,
              type: 'CREDIT' as TransactionType,
              description: 'Service Total Cost',
              balance_after: costVal
            };
            const costRes = await supabase.from('transactions').insert([costTx]).select();
            if (costRes.data?.[0]) {
              newTxList.push({
                id: costRes.data[0].id,
                userId: costRes.data[0].user_id,
                contactId: costRes.data[0].contact_id,
                date: costRes.data[0].date,
                description: costRes.data[0].description,
                amount: costRes.data[0].amount,
                type: costRes.data[0].type,
                balanceAfter: costRes.data[0].balance_after
              });
            }
          }

          if (advanceVal && advanceVal > 0) {
            const balAfter = Math.max(0, (costVal || 0) - advanceVal);
            const advTx = {
              user_id: authUser?.id,
              contact_id: contactId,
              date: effectiveAdvDate,
              amount: advanceVal,
              type: 'PAYMENT' as TransactionType,
              description: 'Advance Payment',
              balance_after: balAfter
            };
            const advRes = await supabase.from('transactions').insert([advTx]).select();
            if (advRes.data?.[0]) {
              newTxList.push({
                id: advRes.data[0].id,
                userId: advRes.data[0].user_id,
                contactId: advRes.data[0].contact_id,
                date: advRes.data[0].date,
                description: advRes.data[0].description,
                amount: advRes.data[0].amount,
                type: advRes.data[0].type,
                balanceAfter: advRes.data[0].balance_after
              });

              // Automatically record advance payment in Cashbook Sales under Repair Charges
              await recordOrUpdateServicePaymentInCashbook({
                txId: advRes.data[0].id,
                contactId: contactId,
                contactName: addName.trim(),
                phoneModel: addPhoneModel.trim(),
                amount: advanceVal,
                date: effectiveAdvDate,
                isAdvance: true
              });
            }
          }

          if (newTxList.length > 0) {
            setTransactions(prev => [...newTxList, ...prev]);
          }
        } else if (isService && editingContact) {
          // If editing an existing service order, sync transactions for Total Cost and Advance Payment including updated dates!
          const existingCostTx = transactions.find(t => t.contactId === editingContact.id && t.description === 'Service Total Cost');
          if (existingCostTx) {
            if (costVal !== null && costVal > 0 && (costVal !== existingCostTx.amount || effectiveOrderDate !== existingCostTx.date)) {
              await supabase.from('transactions').update({ amount: costVal, date: effectiveOrderDate }).eq('id', existingCostTx.id);
              setTransactions(prev => prev.map(t => t.id === existingCostTx.id ? { ...t, amount: costVal, date: effectiveOrderDate } : t));
            }
          } else if (costVal && costVal > 0) {
            const costTx = {
              user_id: authUser?.id,
              contact_id: editingContact.id,
              date: effectiveOrderDate,
              amount: costVal,
              type: 'CREDIT' as TransactionType,
              description: 'Service Total Cost',
              balance_after: costVal
            };
            const cRes = await supabase.from('transactions').insert([costTx]).select();
            if (cRes.data?.[0]) {
              setTransactions(prev => [{
                id: cRes.data[0].id,
                userId: cRes.data[0].user_id,
                contactId: cRes.data[0].contact_id,
                date: cRes.data[0].date,
                description: cRes.data[0].description,
                amount: cRes.data[0].amount,
                type: cRes.data[0].type,
                balanceAfter: cRes.data[0].balance_after
              }, ...prev]);
            }
          }

          const existingAdvTx = transactions.find(t => t.contactId === editingContact.id && t.description === 'Advance Payment');
          if (existingAdvTx) {
            if (advanceVal !== null && advanceVal > 0 && (advanceVal !== existingAdvTx.amount || effectiveAdvDate !== existingAdvTx.date)) {
              await supabase.from('transactions').update({ amount: advanceVal, date: effectiveAdvDate }).eq('id', existingAdvTx.id);
              setTransactions(prev => prev.map(t => t.id === existingAdvTx.id ? { ...t, amount: advanceVal, date: effectiveAdvDate } : t));
              await recordOrUpdateServicePaymentInCashbook({
                txId: existingAdvTx.id,
                contactId: editingContact.id,
                contactName: addName.trim(),
                phoneModel: addPhoneModel.trim(),
                amount: advanceVal,
                date: effectiveAdvDate,
                isAdvance: true
              });
            } else if (advanceVal === 0) {
              await supabase.from('transactions').delete().eq('id', existingAdvTx.id);
              setTransactions(prev => prev.filter(t => t.id !== existingAdvTx.id));
              await removeServicePaymentFromCashbook(existingAdvTx.id);
            }
          } else if (advanceVal && advanceVal > 0) {
            const advTx = {
              user_id: authUser?.id,
              contact_id: editingContact.id,
              date: effectiveAdvDate,
              amount: advanceVal,
              type: 'PAYMENT' as TransactionType,
              description: 'Advance Payment',
              balance_after: 0
            };
            const aRes = await supabase.from('transactions').insert([advTx]).select();
            if (aRes.data?.[0]) {
              setTransactions(prev => [{
                id: aRes.data[0].id,
                userId: aRes.data[0].user_id,
                contactId: aRes.data[0].contact_id,
                date: aRes.data[0].date,
                description: aRes.data[0].description,
                amount: aRes.data[0].amount,
                type: aRes.data[0].type,
                balanceAfter: aRes.data[0].balance_after
              }, ...prev]);
              await recordOrUpdateServicePaymentInCashbook({
                txId: aRes.data[0].id,
                contactId: editingContact.id,
                contactName: addName.trim(),
                phoneModel: addPhoneModel.trim(),
                amount: advanceVal,
                date: effectiveAdvDate,
                isAdvance: true
              });
            }
          }
        }
        
        if (editingContact) {
          setContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c));
          if (selectedContact?.id === editingContact.id) setSelectedContact(updatedContact);
        } else {
          setContacts([...contacts, updatedContact]);
        }
      }
      
      setAddName(''); 
      setAddPhone(''); 
      setAddPhoneModel('');
      setAddTotalCost('');
      setAddAdvancePayment('');
      setAddOrderDate(new Date().toISOString().slice(0, 10));
      setAddAdvanceDate(new Date().toISOString().slice(0, 10));
      setAddServiceStatus('Pending');
      setAddCollectedItems([]);
      setAddOtherCollectedItems('');
      setTargetAmount('30000'); 
      setEditingContact(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteContact = async (id: string, isFromDetail: boolean = true) => {
    if (!userCanDelete) {
      alert("Access Denied: You do not have permission to delete data. Only authorized users with Delete Data Rights can delete records.");
      return;
    }
    const contact = contacts.find(c => c.id === id);
    const itemLabel = contact?.type === 'SERVICE' ? 'Service Order' : (contact?.type === 'RENT' ? 'Rent Record' : 'Contact');
    if (!window.confirm(`Delete this ${itemLabel} entirely? All transactions will be lost.`)) return;
    setIsSubmitting(true);
    try {
      let tq = supabase.from('transactions').delete().eq('contact_id', id);
      let cq = supabase.from('contacts').delete().eq('id', id);
      if (authUser?.id) {
        tq = tq.eq('user_id', authUser.id);
        cq = cq.eq('user_id', authUser.id);
      }
      await tq;
      await cq;

      // Delete linked cashbook entries for transactions belonging to this contact
      const contactTx = transactions.filter(t => t.contactId === id);
      for (const t of contactTx) {
        await removeLinkedCashbookEntry(t.id);
      }
      const refPatterns = [
        `SO-${id.slice(0, 6).toUpperCase()}`,
        `CUST-${id.slice(0, 6).toUpperCase()}`,
        `VEND-${id.slice(0, 6).toUpperCase()}`,
        `RENT-${id.slice(0, 6).toUpperCase()}`
      ];
      for (const ref of refPatterns) {
        try {
          let cbq = supabase.from('cashbook_entries').delete().eq('reference_no', ref);
          if (authUser?.id) cbq = cbq.eq('user_id', authUser.id);
          await cbq;
        } catch (e) {}
      }
      setCashbookEntries(prev => {
        const txIds = new Set(contactTx.map(t => t.id));
        const next = prev.filter(e => !txIds.has(e.id) && !refPatterns.includes(e.referenceNo || ''));
        try {
          const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
          localStorage.setItem(cacheKey, JSON.stringify(next));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(next));
        } catch {}
        return next;
      });

      setContacts(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.filter(t => t.contactId !== id));
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
      if (isFromDetail) {
        handleBack();
      }
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleResetRentCycle = async (id: string) => {
    if (!userCanDelete) {
      alert("Access Denied: Delete Data Rights required to reset or clear cycle transactions.");
      return;
    }
    if (!window.confirm("Target achieved! Clear savings for this cycle and start fresh?")) return;
    setIsSubmitting(true);
    try {
      let tq = supabase.from('transactions').delete().eq('contact_id', id);
      if (authUser?.id) tq = tq.eq('user_id', authUser.id);
      await tq;
      setTransactions(transactions.filter(t => t.contactId !== id));
      alert("New cycle started!");
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteTransaction = async () => {
    if (!userCanDelete) {
      alert("Access Denied: You do not have permission to delete transactions or payments.");
      return;
    }
    if (!editingTransaction || isSubmitting) return;
    if (!window.confirm("Delete this record?")) return;
    setIsSubmitting(true);
    try {
      let q = supabase.from('transactions').delete().eq('id', editingTransaction.id);
      if (authUser?.id) q = q.eq('user_id', authUser.id);
      const { error } = await q;
      if (error) throw error;

      // Also remove linked cashbook sale or expense entry
      await removeLinkedCashbookEntry(editingTransaction.id);

      const newTransactions = transactions.filter(t => t.id !== editingTransaction.id);
      setTransactions(newTransactions);
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!selectedContact || isSubmitting) return;
    const amountVal = parseFloat(transAmount) || 0;
    setIsSubmitting(true);
    try {
      let formattedDesc = transDesc.trim();
      if (transType === 'PAYMENT' || transPaymentMethod === 'Cheque') {
        if (transPaymentMethod === 'Cheque') {
          const parts: string[] = [`Cheque [${transChequeStatus}]`];
          if (transChequeDate) parts.push(`Due: ${transChequeDate}`);
          if (transChequeNumber.trim()) parts.push(`#${transChequeNumber.trim()}`);
          if (transDesc.trim()) parts.push(transDesc.trim());
          formattedDesc = parts.join(' • ');
        } else {
          formattedDesc = transDesc.trim() ? `${transPaymentMethod} • ${transDesc.trim()}` : transPaymentMethod;
        }
      }

      // When cheque is marked as passed, update date to the cheque date
      const effectiveTxDate = (transPaymentMethod === 'Cheque' && transChequeStatus === 'PASSED' && transChequeDate)
        ? transChequeDate
        : transDate;

      const txPayload = { 
        user_id: authUser?.id,
        contact_id: selectedContact.id, 
        date: effectiveTxDate, 
        amount: amountVal, 
        type: transType, 
        description: formattedDesc, 
        balance_after: 0 
      };
      let res;
      if (editingTransaction) { 
        let q = supabase.from('transactions').update(txPayload).eq('id', editingTransaction.id);
        if (authUser?.id) q = q.eq('user_id', authUser.id);
        res = await q.select(); 
      } else { 
        res = await supabase.from('transactions').insert([txPayload]).select(); 
      }
      if (res.error) {
        if (res.error.code === 'PGRST205' || res.error.message?.includes('schema cache') || res.error.message?.includes('not find')) {
          setDbStatus('needs_tables');
          const fallbackTx: Transaction = {
            id: editingTransaction ? editingTransaction.id : generateUUID(),
            contactId: selectedContact.id,
            date: effectiveTxDate,
            amount: amountVal,
            type: transType,
            paymentMethod: transPaymentMethod,
            chequeStatus: transPaymentMethod === 'Cheque' ? transChequeStatus : undefined,
            chequeNumber: transPaymentMethod === 'Cheque' ? transChequeNumber.trim() : undefined,
            chequeDate: transPaymentMethod === 'Cheque' ? transChequeDate : undefined,
            description: formattedDesc,
            balanceAfter: 0
          };
          if (editingTransaction) {
            setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? fallbackTx : t));
          } else {
            setTransactions(prev => [fallbackTx, ...prev]);
          }

          // Link to Cashbook:
          // Customer got money -> Sales
          // Vendor paid money -> Expense
          // Rent deposit -> Expense (Shop Rent) / Rent withdrawal -> Sale (Shop Rent)
          // Service payment -> Sales (Repair Charges)
          const shouldLinkToCashbook = (
            (transType === 'PAYMENT' || (selectedContact.type === 'RENT' && transType === 'CREDIT')) && amountVal > 0
          );

          if (shouldLinkToCashbook) {
            const isPendingChq = transPaymentMethod === 'Cheque' && transChequeStatus === 'PENDING';
            if (isPendingChq) {
              await removeLinkedCashbookEntry(fallbackTx.id);
            } else {
              await recordOrUpdateLinkedCashbookEntry({
                txId: fallbackTx.id,
                contactId: selectedContact.id,
                contactName: selectedContact.name,
                contactType: selectedContact.type,
                txType: transType,
                phoneModel: selectedContact.phoneModel,
                amount: amountVal,
                date: effectiveTxDate,
                paymentMethod: transPaymentMethod,
                descriptionNote: formattedDesc,
                isAdvance: formattedDesc?.toLowerCase().includes('advance')
              });
            }
          } else if (editingTransaction && !shouldLinkToCashbook) {
            await removeLinkedCashbookEntry(editingTransaction.id);
          }

          try {
            const currentTx = JSON.parse(localStorage.getItem('st_cached_transactions') || '[]');
            const nextTx = editingTransaction 
              ? currentTx.map((t: any) => t.id === editingTransaction.id ? fallbackTx : t)
              : [fallbackTx, ...currentTx];
            localStorage.setItem('st_cached_transactions', JSON.stringify(nextTx));
          } catch {}
          showProfileToast("Saved locally! Run Supabase SQL setup to sync to cloud.", "error");
          setEditingTransaction(null);
          handleBack();
          return;
        }
        throw res.error;
      }
      if (res.data) {
        const saved: Transaction = { 
          id: res.data[0].id, 
          contactId: res.data[0].contact_id, 
          date: res.data[0].date, 
          description: res.data[0].description, 
          amount: res.data[0].amount, 
          type: res.data[0].type, 
          paymentMethod: transPaymentMethod,
          chequeStatus: transPaymentMethod === 'Cheque' ? transChequeStatus : undefined,
          chequeNumber: transPaymentMethod === 'Cheque' ? transChequeNumber.trim() : undefined,
          chequeDate: transPaymentMethod === 'Cheque' ? transChequeDate : undefined,
          balanceAfter: 0 
        };
        if (editingTransaction) { 
          setTransactions(transactions.map(t => t.id === editingTransaction.id ? saved : t)); 
        } else { 
          setTransactions([saved, ...transactions]); 
        }

        // Link to Cashbook:
        // Customer got money -> Sales
        // Vendor paid money -> Expense
        // Rent deposit -> Expense (Shop Rent) / Rent withdrawal -> Sale (Shop Rent)
        // Service payment -> Sales (Repair Charges)
        const shouldLinkToCashbook = (
          (transType === 'PAYMENT' || (selectedContact.type === 'RENT' && transType === 'CREDIT')) && amountVal > 0
        );

        if (shouldLinkToCashbook) {
          const isPendingChq = transPaymentMethod === 'Cheque' && transChequeStatus === 'PENDING';
          if (isPendingChq) {
            await removeLinkedCashbookEntry(saved.id);
            showProfileToast("Cheque saved as Pending (Will show in Sales/Expenses once passed)");
          } else {
            await recordOrUpdateLinkedCashbookEntry({
              txId: saved.id,
              contactId: selectedContact.id,
              contactName: selectedContact.name,
              contactType: selectedContact.type,
              txType: transType,
              phoneModel: selectedContact.phoneModel,
              amount: amountVal,
              date: effectiveTxDate,
              paymentMethod: transPaymentMethod,
              descriptionNote: formattedDesc,
              isAdvance: formattedDesc?.toLowerCase().includes('advance')
            });

            const toastMsg = 
              selectedContact.type === 'CUSTOMER' ? "Customer payment saved & linked to Sales (+ Sale)!" :
              selectedContact.type === 'VENDOR' ? "Vendor payment saved & linked to Expenses (- Expense)!" :
              selectedContact.type === 'RENT' ? (transType === 'CREDIT' ? "Rent withdrawal saved & linked to Sales (+ Sale)!" : "Rent deposit saved & linked to Expenses (Shop Rent)!") :
              "Service payment saved & linked to Sales (Repair Charges)!";
            showProfileToast(toastMsg);
          }
        } else if (editingTransaction && !shouldLinkToCashbook) {
          await removeLinkedCashbookEntry(editingTransaction.id);
        }
      }
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleQuickPassCheque = async (tx: Transaction) => {
    const contact = contacts.find(c => c.id === tx.contactId);
    const parsed = parsePaymentMethod(tx.description, tx.paymentMethod, tx.chequeStatus);
    const effectiveChequeDate = parsed.chequeDate || tx.chequeDate || new Date().toISOString().slice(0, 10);
    const sectionName = contact?.type === 'VENDOR' ? 'Expenses' : (contact?.type === 'RENT' ? 'Expenses (Shop Rent)' : 'Sales');

    let updatedDesc = tx.description || '';
    if (updatedDesc.includes('[PENDING]')) {
      updatedDesc = updatedDesc.replace(/\[PENDING\]/gi, '[PASSED]');
    } else if (updatedDesc.includes('[BOUNCED]')) {
      updatedDesc = updatedDesc.replace(/\[BOUNCED\]/gi, '[PASSED]');
    } else if (updatedDesc.startsWith('Cheque')) {
      updatedDesc = updatedDesc.replace(/^Cheque/i, 'Cheque [PASSED]');
    } else {
      updatedDesc = `Cheque [PASSED]${parsed.chequeNumber ? ` • #${parsed.chequeNumber}` : ''}${updatedDesc ? ` • ${updatedDesc}` : ''}`;
    }

    const updatedTx: Transaction = {
      ...tx,
      date: effectiveChequeDate,
      chequeDate: effectiveChequeDate,
      paymentMethod: 'Cheque',
      chequeStatus: 'PASSED',
      description: updatedDesc
    };

    setTransactions(prev => prev.map(t => t.id === tx.id ? updatedTx : t));
    try {
      const currentTx = JSON.parse(localStorage.getItem('st_cached_transactions') || '[]');
      const nextTx = currentTx.map((t: any) => t.id === tx.id ? updatedTx : t);
      localStorage.setItem('st_cached_transactions', JSON.stringify(nextTx));
    } catch {}

    // Update transactions table in Supabase with the passed cheque date
    try {
      let tq = supabase.from('transactions').update({
        date: effectiveChequeDate,
        description: updatedDesc
      }).eq('id', tx.id);
      if (authUser?.id) tq = tq.eq('user_id', authUser.id);
      await tq;
    } catch (e) {
      console.warn('Supabase update cheque status error:', e);
    }

    // Update or insert linked Cashbook entry with the passed cheque date in Expenses or Sales
    if (contact) {
      await recordOrUpdateLinkedCashbookEntry({
        txId: tx.id,
        contactId: tx.contactId,
        contactName: contact.name,
        contactType: contact.type,
        phoneModel: contact.phoneModel,
        amount: tx.amount,
        date: effectiveChequeDate,
        paymentMethod: 'Cheque',
        descriptionNote: updatedDesc,
        isAdvance: updatedDesc.toLowerCase().includes('advance')
      });
    } else {
      setCashbookEntries(prev => {
        const next = prev.map(e => {
          if (e.id === tx.id) {
            return {
              ...e,
              date: effectiveChequeDate,
              description: e.description?.replace(/\[PENDING\]/gi, '[PASSED]') || updatedDesc
            };
          }
          return e;
        });
        try {
          const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
          localStorage.setItem(cacheKey, JSON.stringify(next));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(next));
        } catch {}
        return next;
      });
      try {
        let cbq = supabase.from('cashbook_entries').update({
          date: effectiveChequeDate,
          description: updatedDesc
        }).eq('id', tx.id);
        if (authUser?.id) cbq = cbq.eq('user_id', authUser.id);
        await cbq;
      } catch (e) {
        console.warn('Supabase cashbook update error:', e);
      }
    }

    showProfileToast(`Cheque PASSED! ${sectionName} section date updated to ${formatDisplayDate(effectiveChequeDate)}.`);
  };

  const handlePassChequeFromCashbook = async (entry: CashbookEntry) => {
    const matchingTx = transactions.find(t => t.id === entry.id) ||
      transactions.find(t => isPendingCheque(t) && t.amount === entry.amount);
    if (matchingTx) {
      await handleQuickPassCheque(matchingTx);
    } else {
      const dueDateMatch = entry.description?.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
      const passedDate = dueDateMatch ? dueDateMatch[1] : new Date().toISOString().slice(0, 10);
      const updatedDesc = entry.description?.replace(/\[PENDING\]/gi, '[PASSED]') || (entry.description + ' [PASSED]');

      setCashbookEntries(prev => {
        const next = prev.map(e => e.id === entry.id ? { ...e, date: passedDate, description: updatedDesc } : e);
        try {
          const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
          localStorage.setItem(cacheKey, JSON.stringify(next));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(next));
        } catch {}
        return next;
      });

      try {
        let q = supabase.from('cashbook_entries').update({
          date: passedDate,
          description: updatedDesc
        }).eq('id', entry.id);
        if (authUser?.id) q = q.eq('user_id', authUser.id);
        await q;
      } catch (e) {
        console.warn('Supabase cashbook update error:', e);
      }
      showProfileToast(`Cheque passed! Date updated to ${formatDisplayDate(passedDate)}.`);
    }
  };

  const renderReportModal = () => {
    if (!isReportModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
        <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-lg">Generate Report</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{reportTarget === 'CATEGORY' ? activeTab : selectedContact?.name}</p>
            </div>
            <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-white rounded-full shadow-sm"><X size={18} /></button>
          </div>
          <div className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                <input type="date" value={reportRange.start} onChange={e => setReportRange({ ...reportRange, start: e.target.value })} className="w-full border rounded-xl p-3 font-semibold text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</label>
                <input type="date" value={reportRange.end} onChange={e => setReportRange({ ...reportRange, end: e.target.value })} className="w-full border rounded-xl p-3 font-semibold text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 mt-2 shadow-inner">
               <div className="flex justify-between items-center">
                 <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                   {reportTarget === 'CONTACT' ? 
                     (selectedContact?.type === 'RENT' ? 'Total Withdrawals' : (selectedContact?.type === 'CUSTOMER' ? 'Total Credit' : (selectedContact?.type === 'SERVICE' ? 'Total Charges' : 'Total Items'))) :
                     (activeTab === 'RENT' ? 'Total Withdrawals' : (activeTab === 'CUSTOMER' ? 'Total Credit' : (activeTab === 'SERVICE' ? 'Total Charges' : 'Total Items')))
                   }
                 </span>
                 <span className="font-bold text-red-600 text-sm">LKR {reportTotals.totalCredit.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                   {reportTarget === 'CONTACT' ? 
                     (selectedContact?.type === 'RENT' ? 'Total Deposits' : (selectedContact?.type === 'CUSTOMER' ? 'Total Received' : (selectedContact?.type === 'SERVICE' ? 'Total Received' : 'Total Paid'))) :
                     (activeTab === 'RENT' ? 'Total Deposits' : (activeTab === 'CUSTOMER' ? 'Total Received' : (activeTab === 'SERVICE' ? 'Total Received' : 'Total Paid')))
                   }
                 </span>
                 <span className="font-bold text-green-600 text-sm">LKR {reportTotals.totalPaid.toLocaleString()}</span>
               </div>
            </div>

            <button 
              onClick={() => reportTarget === 'CATEGORY' ? downloadCategoryReport() : (selectedContact && downloadContactStatement(selectedContact))}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-2 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} /> Download PDF Report
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const currentTabContacts = contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER'));

    // Compute pending cheques count & total strictly for contacts in the CURRENT active tab (Customer or Vendor)
    const contactsWithPendingCheques = currentTabContacts.filter(c => {
      const s = contactStats[c.id];
      return s && s.pendingChequesCount > 0;
    });

    const pendingChequesCountTotal = contactsWithPendingCheques.reduce((sum, c) => sum + (contactStats[c.id]?.pendingChequesCount || 0), 0);
    const pendingChequesAmountTotal = contactsWithPendingCheques.reduce((sum, c) => sum + (contactStats[c.id]?.pendingChequesAmount || 0), 0);

    const tabNounSingular = activeTab === 'VENDOR' ? 'vendor' : activeTab === 'CUSTOMER' ? 'customer' : activeTab === 'RENT' ? 'account' : 'order';
    const tabNounPlural = activeTab === 'VENDOR' ? 'vendors' : activeTab === 'CUSTOMER' ? 'customers' : activeTab === 'RENT' ? 'accounts' : 'orders';

    const filtered = currentTabContacts.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.phoneModel && c.phoneModel.toLowerCase().includes(q))
      );
      if (!matchesSearch) return false;
      if (filterNeedsAttention) {
        return (contactStats[c.id]?.pendingChequesCount || 0) > 0;
      }
      return true;
    });

    const userInitials = (currentUser?.name || 'User')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080d16] text-slate-800 dark:text-slate-100 flex flex-col pb-24 no-scrollbar transition-colors">
        {/* Top App Header */}
        <header className="bg-white dark:bg-[#0b101d] px-4 sm:px-6 py-3 shadow-xs dark:shadow-none border-b border-slate-200 dark:border-[#1e2a3c] sticky top-0 z-30 transition-colors">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-3">
              {/* Brand logo & Shop title */}
              <div 
                onClick={() => navigateTo('PROFILE')} 
                className="flex items-center gap-3 cursor-pointer group"
                title="Click to view & edit Profile"
              >
                {shopLogo ? (
                  <img src={shopLogo} alt="Logo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-slate-200 dark:border-[#1e2a3c] shadow-xs group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:opacity-90 transition-opacity">
                    <Store size={20} />
                  </div>
                )}
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-500 transition-colors">Ledger Book</h1>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{shopName || 'Smart Time'}</p>
                </div>
              </div>

              {/* Header Right Actions & User Profile */}
              <div className="flex items-center gap-2">
                {/* Dark / Light Mode Toggle Button */}
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-[#1a2332] text-slate-600 dark:text-amber-400 border border-slate-200 dark:border-[#263448] hover:bg-slate-200 dark:hover:bg-[#222e42] transition-all shadow-xs active:scale-95 flex items-center justify-center"
                  title={isDarkMode ? "Switch to Normal (Light) Mode" : "Switch to Dark Mode"}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <span className="hidden sm:inline text-xs font-bold text-slate-500 dark:text-slate-400">Shop</span>

                <button 
                  onClick={() => navigateTo('PROFILE')}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-600 hover:ring-2 hover:ring-blue-500 transition-all"
                  title={`Logged in as ${currentUser.name} (${currentUser.role})`}
                >
                  {userInitials}
                </button>

                <button 
                  onClick={handleSignOut}
                  className="hidden sm:flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900/50 transition-colors shadow-xs active:scale-95"
                  title="Sign Out of Shop Account"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>

                <button 
                  onClick={() => { setEditingContact(null); setAddName(''); setAddPhone(''); setAddPhoneModel(''); setAddTotalCost(''); setAddAdvancePayment(''); setAddServiceStatus('Pending'); setAddCollectedItems([]); setAddOtherCollectedItems(''); setTargetAmount('30000'); navigateTo('CONTACT_FORM'); }} 
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl shadow-sm active:scale-90 transition-transform flex items-center justify-center" 
                  title="Add New Party / Order"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex gap-6 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 dark:border-[#1e2a3c]">
              <button 
                onClick={() => { setActiveTab('CUSTOMER'); setFilterNeedsAttention(false); }} 
                className={`flex items-center gap-2 pb-2.5 border-b-2 font-bold text-sm transition-all shrink-0 ${activeTab === 'CUSTOMER' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <Users size={17} />
                <span>Customers</span>
              </button>

              <button 
                onClick={() => { setActiveTab('VENDOR'); setFilterNeedsAttention(false); }} 
                className={`flex items-center gap-2 pb-2.5 border-b-2 font-bold text-sm transition-all shrink-0 ${activeTab === 'VENDOR' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <Truck size={17} />
                <span>Vendors</span>
              </button>

              <button 
                onClick={() => { setActiveTab('RENT'); setFilterNeedsAttention(false); }} 
                className={`flex items-center gap-2 pb-2.5 border-b-2 font-bold text-sm transition-all shrink-0 ${activeTab === 'RENT' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <Building size={17} />
                <span>Rent</span>
              </button>

              <button 
                onClick={() => { setActiveTab('SERVICE'); setFilterNeedsAttention(false); }} 
                className={`flex items-center gap-2 pb-2.5 border-b-2 font-bold text-sm transition-all shrink-0 ${activeTab === 'SERVICE' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <Wrench size={17} />
                <span>Service orders</span>
              </button>
            </div>
          </div>
        </header>

        {/* Supabase Table Initialization Alert Banner */}
        {dbStatus === 'needs_tables' && !dismissDbAlert && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Database size={15} className="shrink-0 animate-pulse text-amber-200" />
              <div>
                <span className="font-bold">Supabase: {SUPABASE_PROJECT_NAME}</span>
                <span className="hidden sm:inline opacity-90 ml-1.5">• Tables need to be initialized in your Supabase SQL Editor.</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => setIsSqlModalOpen(true)}
                className="bg-white text-orange-900 font-bold px-2.5 py-1 rounded-lg text-[10px] shadow-xs hover:bg-orange-50 active:scale-95 transition-all flex items-center gap-1"
              >
                <Copy size={11} /> Copy SQL
              </button>
              <button 
                onClick={() => setDismissDbAlert(true)}
                className="text-white/80 hover:text-white p-1"
                title="Dismiss banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
          {/* View Heading & Primary Action Buttons (matching image attachment) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeTab === 'VENDOR' ? 'Vendors' : activeTab === 'CUSTOMER' ? 'Customers' : activeTab === 'RENT' ? 'Shop Rent' : 'Service orders'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {activeTab === 'VENDOR' ? 'Track balances, payments, and supplier follow-ups.' : 
                 activeTab === 'CUSTOMER' ? 'Track customer credit, payments, and histories.' : 
                 activeTab === 'RENT' ? 'Manage rent savings, monthly target, and expense sync.' : 
                 'Track device repairs, service progress, and invoices.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => { setEditingContact(null); setAddName(''); setAddPhone(''); setAddPhoneModel(''); setAddTotalCost(''); setAddAdvancePayment(''); setAddServiceStatus('Pending'); setAddCollectedItems([]); setAddOtherCollectedItems(''); setTargetAmount('30000'); navigateTo('CONTACT_FORM'); }}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2332] dark:hover:bg-[#222e42] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#2b3950] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                <Plus size={15} />
                <span>+ Add {activeTab === 'VENDOR' ? 'vendor' : activeTab === 'CUSTOMER' ? 'customer' : activeTab === 'RENT' ? 'rent account' : 'order'}</span>
              </button>

              <button 
                onClick={() => {
                  if (filtered.length > 0) {
                    setSelectedContact(filtered[0]);
                    navigateTo('TRANSACTION_FORM');
                  } else {
                    navigateTo('CONTACT_FORM');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Plus size={15} />
                <span>+ Record payment</span>
              </button>
            </div>
          </div>

          {/* 3 KPI Summary Cards (matching image attachment) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Total Outstanding */}
            <div className="bg-white dark:bg-[#131b2a] border border-slate-200 dark:border-[#1e2a3c] rounded-2xl p-4 shadow-xs flex flex-col justify-between min-h-[90px] transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total outstanding</p>
              <div>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">LKR {activeTotals.netBalance.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Across {filtered.length} {activeTab.toLowerCase()}{filtered.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Card 2: Paid This Month */}
            <div className="bg-white dark:bg-[#131b2a] border border-slate-200 dark:border-[#1e2a3c] rounded-2xl p-4 shadow-xs flex flex-col justify-between min-h-[90px] transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Paid this month</p>
              <div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">LKR {activeTotals.totalPayments.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Across settled transactions
                </p>
              </div>
            </div>

            {/* Card 3: Needs Attention - Filtered strictly by activeTab */}
            <div 
              onClick={() => {
                if (contactsWithPendingCheques.length > 0) {
                  setFilterNeedsAttention(!filterNeedsAttention);
                }
              }}
              className={`bg-white dark:bg-[#131b2a] border rounded-2xl p-4 shadow-xs flex flex-col justify-between min-h-[90px] transition-all ${
                contactsWithPendingCheques.length > 0 ? 'cursor-pointer' : ''
              } ${
                filterNeedsAttention 
                  ? 'border-amber-500 ring-2 ring-amber-500/30 dark:ring-amber-400/20' 
                  : 'border-slate-200 dark:border-[#1e2a3c] hover:border-amber-400/70 dark:hover:border-amber-500/40'
              }`}
              title={contactsWithPendingCheques.length > 0 ? (filterNeedsAttention ? 'Click to show all' : `Click to filter ${activeTab.toLowerCase()}s with pending cheques`) : undefined}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Needs attention</p>
                {filterNeedsAttention && (
                  <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                    Filter Active
                  </span>
                )}
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {contactsWithPendingCheques.length > 0 
                    ? `${contactsWithPendingCheques.length} ${contactsWithPendingCheques.length === 1 ? tabNounSingular : tabNounPlural}` 
                    : 'All clear'}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  {pendingChequesCountTotal > 0 
                    ? `${pendingChequesCountTotal} cheque${pendingChequesCountTotal === 1 ? '' : 's'} due · LKR ${pendingChequesAmountTotal.toLocaleString()}` 
                    : 'No pending cheques on hold'}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Sales & Expenses Widget (matching image attachment) */}
          <div 
            onClick={() => navigateTo('CASH_BOOK')} 
            className="bg-slate-900 text-white dark:bg-[#162032] dark:border dark:border-[#223046] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-blue-500/80 transition-all group active:scale-[0.995]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                <Wallet size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-white group-hover:text-blue-400 transition-colors">Today’s sales & expenses</span>
                  <span className="text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800/60 font-bold px-2.5 py-0.5 rounded-full">
                    {todayCashbookSnapshot.count} entries
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Quick view of today’s cash movement</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-emerald-400 font-extrabold">Sales +LKR {todayCashbookSnapshot.sales.toLocaleString()}</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400 font-extrabold">Expenses -LKR {todayCashbookSnapshot.expenses.toLocaleString()}</span>
                <span className="text-slate-600">•</span>
                <span className="text-white font-black">
                  Net {todayCashbookSnapshot.net >= 0 ? '+' : ''}LKR {todayCashbookSnapshot.net.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 dark:bg-[#1f2d42] dark:hover:bg-[#283852] border border-slate-700 dark:border-[#2e3e5a] px-3.5 py-1.5 rounded-xl transition-all">
                <span>Open daybook</span>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>

          {/* Main Card Container: Balances List & Controls (matching image attachment) */}
          <div className="bg-white dark:bg-[#131b2a] border border-slate-200 dark:border-[#1e2a3c] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4 transition-colors">
            {/* Header controls bar: Title, Search, Export, Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  {activeTab === 'VENDOR' ? 'Vendor balances' : activeTab === 'CUSTOMER' ? 'Customer balances' : activeTab === 'RENT' ? 'Rent Accounts' : 'Service Order List'}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>
                    {filtered.length} {activeTab.toLowerCase()}{filtered.length === 1 ? '' : 's'} {filterNeedsAttention ? 'with pending cheques' : '· sorted by amount owed'}
                  </span>
                  {filterNeedsAttention && (
                    <button 
                      onClick={() => setFilterNeedsAttention(false)}
                      className="text-blue-600 dark:text-blue-400 underline font-bold hover:opacity-80 text-[11px]"
                    >
                      Show all {activeTab.toLowerCase()}s
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="bg-slate-100 dark:bg-[#0d131f] border border-slate-200 dark:border-[#1e2a3c] rounded-xl px-3 py-1.5 flex items-center flex-1 sm:w-64 transition-all focus-within:border-blue-500">
                  <Search size={15} className="text-slate-400 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    placeholder={activeTab === 'SERVICE' ? "Search name, phone, or model" : `Search ${activeTab.toLowerCase()}s...`} 
                    className="bg-transparent outline-none text-xs w-full text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                  />
                </div>

                <button 
                  onClick={() => { setReportTarget('CATEGORY'); setIsReportModalOpen(true); }}
                  className="bg-slate-100 dark:bg-[#1a2332] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#263448] hover:bg-slate-200 dark:hover:bg-[#222e42] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                  title="Export PDF Report"
                >
                  <Download size={14} />
                  <span>Export</span>
                </button>

                <button 
                  className="bg-slate-100 dark:bg-[#1a2332] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#263448] hover:bg-slate-200 dark:hover:bg-[#222e42] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                  title="Filter options"
                >
                  <Filter size={14} />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            {/* Content Table / Cards */}
            {activeTab === 'SERVICE' ? (
              <div className="flex flex-col gap-3">
                {filtered.map(c => {
                  const stats = contactStats[c.id];
                  const totalCost = stats?.totalCredit || c.totalCost || c.targetAmount || 0;
                  const advancePaid = stats?.totalPayment || c.advancePayment || 0;
                  const balanceDue = totalCost - advancePaid;
                  const isPrintMenuOpen = printMenuContactId === c.id;

                  return (
                    <div 
                      key={c.id} 
                      onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} 
                      className="bg-slate-50 dark:bg-[#162032] p-4 rounded-2xl border border-slate-200 dark:border-[#223046] shadow-xs flex flex-col gap-3 active:bg-slate-100/70 dark:active:bg-[#1a273d] cursor-pointer transition-all relative hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-xs">
                            <Smartphone size={20} />
                          </div>
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 dark:text-white text-base truncate leading-tight">{c.name}</h3>
                              {c.serviceStatus && (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  c.serviceStatus === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400' :
                                  c.serviceStatus === 'Ready' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400' :
                                  c.serviceStatus === 'In Progress' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400' :
                                  'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                  {c.serviceStatus}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {c.phone && <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.phone}</span>}
                              {c.phone && c.phoneModel && <span className="text-slate-300 dark:text-slate-600">•</span>}
                              {c.phoneModel && (
                                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50">
                                  {c.phoneModel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-0.5">Balance Due</p>
                          <p className={`font-black text-lg ${balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            LKR {Math.abs(balanceDue).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-white dark:bg-[#0d131f] px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e2a3c] text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Total Cost:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">LKR {totalCost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Advance Paid:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">LKR {advancePaid.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-[#1e2a3c] relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(c);
                          }}
                          className="flex-1 py-1.5 px-2 bg-slate-200 dark:bg-[#1a2332] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs active:scale-95"
                        >
                          <Eye size={14} />
                          <span>Preview</span>
                        </button>

                        <div className="relative flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintMenuContactId(isPrintMenuOpen ? null : c.id);
                            }}
                            className={`w-full py-1.5 px-2 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs active:scale-95 ${
                              isPrintMenuOpen ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                            }`}
                          >
                            <Printer size={14} />
                            <span>Print</span>
                            <ChevronDown size={12} className={isPrintMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                          </button>

                          {isPrintMenuOpen && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-full mb-1 left-0 right-0 sm:w-56 bg-white dark:bg-[#131b2a] rounded-xl shadow-xl border border-slate-200 dark:border-[#1e2a3c] p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150"
                            >
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Choose PDF Format</p>
                              <button
                                onClick={() => {
                                  setPrintMenuContactId(null);
                                  generateServicePDF(c, 'POS');
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2332] flex items-center gap-2"
                              >
                                <Receipt size={14} className="text-indigo-600 dark:text-indigo-400" />
                                <span>POS Receipt (80mm)</span>
                              </button>
                              <button
                                onClick={() => {
                                  setPrintMenuContactId(null);
                                  generateServicePDF(c, 'A4');
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2332] flex items-center gap-2"
                              >
                                <FileText size={14} className="text-blue-600 dark:text-blue-400" />
                                <span>A4 Invoice PDF</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditServiceOrder(c);
                          }}
                          className="py-1.5 px-3 bg-slate-200 dark:bg-[#1a2332] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs active:scale-95"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>

                        {userCanDelete ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContact(c.id, false);
                            }}
                            className="py-1.5 px-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs active:scale-95"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* High quality Table & Cards for Vendor / Customer / Rent matching image_f55cac7e.png */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1e2a3c] text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3">{activeTab === 'VENDOR' ? 'VENDOR' : activeTab === 'CUSTOMER' ? 'CUSTOMER' : 'ACCOUNT'}</th>
                      <th className="py-3 px-3 text-right">{activeTab === 'RENT' ? 'SAVED TARGET' : (activeTab === 'VENDOR' ? 'AMOUNT RECEIVED' : 'CREDIT GIVEN')}</th>
                      <th className="py-3 px-3 text-right">{activeTab === 'RENT' ? 'SAVED THIS CYCLE' : 'PAID'}</th>
                      <th className="py-3 px-3 text-right">BALANCE DUE</th>
                      <th className="py-3 px-3">UPCOMING PAYMENT</th>
                      <th className="py-3 px-3 text-center">STATUS</th>
                      <th className="py-3 px-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1e2a3c]/60 text-xs">
                    {filtered.map(c => {
                      const stats = contactStats[c.id] || { totalCredit: 0, totalPayment: 0, balance: 0, pendingChequesCount: 0, pendingChequesAmount: 0 };
                      const displayBal = stats.balance;
                      const initialLetter = c.name ? c.name[0].toUpperCase() : '?';
                      
                      let statusLabel = 'Outstanding';
                      let statusBadgeClass = 'bg-rose-950/40 text-rose-400 border border-rose-800/50';
                      
                      if (displayBal <= 0 && stats.totalPayment > 0) {
                        statusLabel = 'Settled';
                        statusBadgeClass = 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50';
                      } else if (stats.totalPayment > 0) {
                        statusLabel = 'Part paid';
                        statusBadgeClass = 'bg-amber-950/40 text-amber-400 border border-amber-800/50';
                      }

                      return (
                        <tr 
                          key={c.id} 
                          onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} 
                          className="hover:bg-slate-50/80 dark:hover:bg-[#162032] cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                                {initialLetter}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{c.name}</h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                  {activeTab === 'VENDOR' ? 'Vendor' : 'Customer'} • {c.phone || 'No phone'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                            LKR {stats.totalCredit.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            LKR {stats.totalPayment.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-3 text-right font-black text-rose-600 dark:text-rose-400 text-sm">
                            LKR {Math.abs(displayBal).toLocaleString()}
                          </td>

                          <td className="py-3.5 px-3 font-medium">
                            {stats.pendingChequesCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2.5 py-0.5 rounded-full">
                                <Clock size={11} />
                                {stats.pendingChequesCount} cheque - LKR {stats.pendingChequesAmount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-xs">No upcoming payment</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${statusBadgeClass}`}>
                              {statusLabel}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedContact(c);
                                navigateTo('DETAIL', c.id);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2332] dark:hover:bg-[#243146] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#2b3b54] px-3.5 py-1 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-semibold">
                No {activeTab === 'SERVICE' ? 'service orders' : activeTab.toLowerCase() + 's'} recorded yet
              </div>
            )}

            {/* Table Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-[#1e2a3c] text-xs text-slate-400 dark:text-slate-500 font-semibold">
              <span>Showing {filtered.length} of {contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER')).length} {activeTab.toLowerCase()}s</span>
              <span>Tip: select a {activeTab.toLowerCase()} to see their full payment history.</span>
            </div>
          </div>
        </div>

        {/* Global Bottom Navigation */}
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  };

  const renderDetail = () => {
    if (!selectedContact) return null;
    const isRent = selectedContact.type === 'RENT';
    const isService = selectedContact.type === 'SERVICE';
    const balance = contactStats[selectedContact.id]?.balance || 0;
    const target = selectedContact.targetAmount || 30000;
    const isTargetAchieved = isRent && balance >= target;

    const labelLeft = isRent ? "WITHDRAW" : (selectedContact.type === 'VENDOR' ? "GOT ITEMS" : (isService ? "SERVICE CHARGE" : "GAVE ITEMS"));
    const labelRight = isRent ? "DEPOSIT" : (selectedContact.type === 'VENDOR' ? "PAID MONEY" : (isService ? "PAYMENT RECEIVED" : "GOT MONEY"));
    
    const contactTransactions = transactions
      .filter(t => t.contactId === selectedContact.id)
      .sort((a,b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
        if (a.type === b.type) return 0;
        return a.type === 'CREDIT' ? 1 : -1;
      });
    
    let currentSum = 0;
    const computedWithBalance = contactTransactions.map(t => {
      // Pending Cheques do NOT alter the balance!
      if (!isPendingCheque(t)) {
        if (isRent) { currentSum += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { currentSum += (t.type === 'CREDIT' ? t.amount : -t.amount); }
      }
      return { ...t, balanceAfter: currentSum };
    }).reverse();

    const pendingChequesNet = contactTransactions
      .filter(t => isPendingCheque(t))
      .reduce((sum, t) => {
        if (isRent) {
          return sum + (t.type === 'PAYMENT' ? t.amount : -t.amount);
        }
        return sum + (t.type === 'PAYMENT' ? -t.amount : t.amount);
      }, 0);

    const balanceIfPassCheque = balance + pendingChequesNet;
    const pendingChequesCount = contactStats[selectedContact.id]?.pendingChequesCount || 0;
    const pendingChequesAmount = contactStats[selectedContact.id]?.pendingChequesAmount || 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const pendingContactCheques = contactTransactions.filter(t => isPendingCheque(t));
    const dueOrPassedCheques = pendingContactCheques.filter(t => {
      const parsed = parsePaymentMethod(t.description, t.paymentMethod, t.chequeStatus);
      const chqDate = parsed.chequeDate || t.chequeDate || t.date;
      return chqDate <= todayStr;
    });

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-28 no-scrollbar">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
          <div className="flex-1 overflow-hidden">
            <h1 className="font-bold text-lg truncate">{selectedContact.name}</h1>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {selectedContact.phone || 'No phone'}
              {isService && selectedContact.phoneModel ? ` • ${selectedContact.phoneModel}` : ''}
              {isService && selectedContact.serviceStatus ? ` (${selectedContact.serviceStatus})` : ''}
            </p>
          </div>
          {isService ? (
            <div className="flex items-center gap-1.5 relative">
              <button 
                onClick={() => openPreview(selectedContact)} 
                className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full active:scale-90 shadow-sm transition-colors" 
                title="Preview Service Order"
              >
                <Eye size={18} />
              </button>

              <button 
                onClick={() => setPrintMenuContactId(printMenuContactId === selectedContact.id ? null : selectedContact.id)} 
                className={`p-2 rounded-full active:scale-90 shadow-sm transition-colors ${
                  printMenuContactId === selectedContact.id ? 'bg-blue-600 text-white' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                }`} 
                title="Print Service Order (POS / A4)"
              >
                <Printer size={18} />
              </button>

              {printMenuContactId === selectedContact.id && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Choose PDF Format</p>
                  <button
                    onClick={() => {
                      setPrintMenuContactId(null);
                      generateServicePDF(selectedContact, 'POS');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Receipt size={15} className="text-indigo-600" />
                    <span>POS Receipt (80mm)</span>
                  </button>
                  <button
                    onClick={() => {
                      setPrintMenuContactId(null);
                      generateServicePDF(selectedContact, 'A4');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <FileText size={15} className="text-blue-600" />
                    <span>A4 Invoice PDF</span>
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setPrintMenuContactId(null);
                        openPreview(selectedContact);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Eye size={12} />
                      <span>Preview Both First</span>
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => handleEditServiceOrder(selectedContact)} 
                className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full active:scale-90 shadow-sm transition-colors" 
                title="Edit Service Order"
              >
                <Pencil size={18} />
              </button>
              {userCanDelete && (
                <button 
                  onClick={() => handleDeleteContact(selectedContact.id, true)} 
                  className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-full active:scale-90 shadow-sm transition-colors"
                  title="Delete Service Order"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setReportTarget('CONTACT'); setIsReportModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-full active:scale-90 shadow-sm" title="Download Statement"><Download size={18} /></button>
              <button onClick={() => { 
                setEditingContact(selectedContact); 
                setAddName(selectedContact.name); 
                setAddPhone(selectedContact.phone); 
                setTargetAmount(selectedContact.targetAmount?.toString() || '30000'); 
                setAddPhoneModel(selectedContact.phoneModel || ''); 
                setAddTotalCost(selectedContact.totalCost?.toString() || selectedContact.targetAmount?.toString() || (contactStats[selectedContact.id]?.totalCredit ? contactStats[selectedContact.id].totalCredit.toString() : '')); 
                setAddAdvancePayment(selectedContact.advancePayment?.toString() || (contactStats[selectedContact.id]?.totalPayment ? contactStats[selectedContact.id].totalPayment.toString() : '')); 
                setAddServiceStatus(selectedContact.serviceStatus || 'Pending'); 
                setAddCollectedItems(selectedContact.collectedItems || []);
                setAddOtherCollectedItems(selectedContact.otherCollectedItems || '');
                navigateTo('CONTACT_FORM'); 
              }} className="p-2 text-slate-600 bg-slate-100 rounded-full active:scale-90 shadow-sm" title="Edit Contact"><Pencil size={18} /></button>
              {userCanDelete && (
                <button onClick={() => handleDeleteContact(selectedContact.id, true)} className="p-2 text-red-500 bg-red-50 rounded-full active:scale-90 shadow-sm" title="Delete Record"><Trash2 size={18} /></button>
              )}
            </div>
          )}
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner relative overflow-hidden">
            {isTargetAchieved && (
              <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase tracking-widest">Target Met!</div>
            )}
            {isService && (
              <div className="flex flex-col items-center gap-2 mb-3">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {selectedContact.phoneModel && (
                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                      <Smartphone size={13} /> {selectedContact.phoneModel}
                    </span>
                  )}
                  {selectedContact.serviceStatus && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      selectedContact.serviceStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                      selectedContact.serviceStatus === 'Ready' ? 'bg-blue-100 text-blue-800' :
                      selectedContact.serviceStatus === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedContact.serviceStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-bold mt-1 bg-slate-100/70 px-3 py-1.5 rounded-xl">
                  <span className="text-red-600">Total: LKR {(contactStats[selectedContact.id]?.totalCredit || selectedContact.targetAmount || selectedContact.totalCost || 0).toLocaleString()}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-green-600">Advance/Paid: LKR {(contactStats[selectedContact.id]?.totalPayment || selectedContact.advancePayment || 0).toLocaleString()}</span>
                </div>

                {/* Collected Items with Device Banner */}
                <div className="w-full bg-white/90 border border-slate-200/90 rounded-xl p-2.5 mt-2 text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Package size={12} className="text-indigo-600" />
                      Received Items with Phone
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold">
                      {(selectedContact.collectedItems?.length || 0) + (selectedContact.otherCollectedItems ? 1 : 0)} Item(s)
                    </span>
                  </div>
                  {selectedContact.collectedItems && selectedContact.collectedItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedContact.collectedItems.map(item => (
                        <span key={item} className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                          <Check size={11} className="text-emerald-600 stroke-[3]" />
                          {item}
                        </span>
                      ))}
                      {selectedContact.otherCollectedItems && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200">
                          + {selectedContact.otherCollectedItems}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium italic">
                      {selectedContact.otherCollectedItems ? `Other: ${selectedContact.otherCollectedItems}` : 'Device Only (No external accessories or SIM/tray recorded)'}
                    </p>
                  )}
                </div>
              </div>
            )}
            {pendingChequesCount > 0 ? (
              <div className="space-y-3.5 my-1">
                {/* Dual / 3-Card Balance View */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Total Balance Right Now */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Total Balance (Current)
                    </span>
                    <span className={`text-2xl sm:text-3xl font-extrabold ${balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
                      LKR {Math.abs(balance).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1">
                      {isRent ? 'Active Saved' : (isService ? 'Balance Due' : (balance > 0 ? 'Amount Owed Right Now' : 'Advance Balance'))}
                    </span>
                  </div>

                  {/* Card 2: Cheque on Hold */}
                  <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/90 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Clock size={12} className="text-amber-700" />
                      Cheque on Hold
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-800">
                      LKR {pendingChequesAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 mt-1 bg-amber-100 px-2 py-0.5 rounded-full">
                      {pendingChequesCount} Pending Cheque{pendingChequesCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Card 3: If Pass Cheque Total Balance */}
                  <div className="bg-emerald-50/90 rounded-2xl p-4 border-2 border-emerald-400 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                      After Clearance
                    </div>
                    <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-700" />
                      If Pass Cheque Total Balance
                    </span>
                    <span className={`text-2xl sm:text-3xl font-extrabold ${balanceIfPassCheque > 0 ? (isRent ? 'text-blue-700' : 'text-emerald-700') : 'text-emerald-800'}`}>
                      LKR {Math.abs(balanceIfPassCheque).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 mt-1">
                      {balanceIfPassCheque === 0 ? 'Fully Paid / Zero Due' : (balanceIfPassCheque > 0 ? 'Remaining Balance' : 'Advance Balance')}
                    </span>
                  </div>
                </div>

                {/* Status Notice Banner */}
                <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 text-left flex items-start gap-2.5 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-800 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-xs text-amber-900">
                        {pendingChequesCount} Pending Cheque{pendingChequesCount > 1 ? 's' : ''} (LKR {pendingChequesAmount.toLocaleString()}) on Hold
                      </span>
                      <span className="text-[10px] font-extrabold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full uppercase">On Hold</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1 font-medium leading-snug">
                      Current Total Balance is <strong>LKR {Math.abs(balance).toLocaleString()}</strong>. Once cheques clear and pass, the balance will become <strong className="text-emerald-800 underline font-bold">LKR {Math.abs(balanceIfPassCheque).toLocaleString()}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className={`text-4xl font-bold ${balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
                  LKR {Math.abs(balance).toLocaleString()}
                </h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
                  {isRent ? `Saved / Target LKR ${target.toLocaleString()}` : (isService ? 'Balance Due' : 'Total Balance')}
                </p>
              </div>
            )}

            {isService && (
              <div className="flex items-center justify-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => openPreview(selectedContact)}
                  className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Preview Receipt & Invoice"
                >
                  <Eye size={14} className="text-indigo-600" /> Preview
                </button>
                <button
                  onClick={() => generateServicePDF(selectedContact, 'POS')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Download / Print POS 80mm Receipt"
                >
                  <Receipt size={14} /> POS Receipt (80mm)
                </button>
                <button
                  onClick={() => generateServicePDF(selectedContact, 'A4')}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Download / Print A4 Invoice PDF"
                >
                  <FileText size={14} /> A4 Invoice PDF
                </button>
                <button
                  onClick={() => handleEditServiceOrder(selectedContact)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Edit Service Order"
                >
                  <Pencil size={14} /> Edit
                </button>
                {userCanDelete && (
                  <button
                    onClick={() => handleDeleteContact(selectedContact.id, true)}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    title="Delete Service Order"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            )}
            {isTargetAchieved && (
              <button 
                onClick={() => handleResetRentCycle(selectedContact.id)}
                className="mt-4 bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
              >
                <RotateCcw size={14} /> Clear & Start New
              </button>
            )}
          </div>
        </div>

        {dueOrPassedCheques.length > 0 && (
          <div className="mx-4 mb-3 p-3.5 bg-gradient-to-r from-amber-50 via-emerald-50 to-blue-50 border-2 border-emerald-400 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Landmark size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    Cheque Maturity Date Passed / Due ({dueOrPassedCheques.length})
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Maturity date arrived. Pass cheque to clear and update {selectedContact.type === 'VENDOR' ? 'Expenses' : (selectedContact.type === 'RENT' ? 'Expenses (Shop Rent)' : 'Sales')} date.
                  </p>
                </div>
              </div>
              {dueOrPassedCheques.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    for (const chq of dueOrPassedCheques) {
                      await handleQuickPassCheque(chq);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs active:scale-95 transition-all flex items-center gap-1"
                >
                  <CheckCircle2 size={13} />
                  <span>Pass All ({dueOrPassedCheques.length})</span>
                </button>
              )}
            </div>
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-200/70">
              {dueOrPassedCheques.map(chq => {
                const parsed = parsePaymentMethod(chq.description, chq.paymentMethod, chq.chequeStatus);
                const chqDate = parsed.chequeDate || chq.chequeDate || chq.date;
                const targetSection = selectedContact.type === 'VENDOR' ? 'Expenses' : (selectedContact.type === 'RENT' ? 'Expenses (Shop Rent)' : 'Sales');
                return (
                  <div key={chq.id} className="bg-white/95 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-slate-900">
                          LKR {chq.amount.toLocaleString()}
                        </span>
                        {parsed.chequeNumber && (
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            #{parsed.chequeNumber}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Clock size={10} /> Cheque Date: {formatDisplayDate(chqDate)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Will clear & set {targetSection} date to <strong className="text-slate-700">{formatDisplayDate(chqDate)}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickPassCheque(chq)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0"
                    >
                      <CheckCircle2 size={13} />
                      <span>Pass Cheque</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isService ? (
          <div className="flex-1 bg-gray-50 p-4 space-y-4">
            {/* Payment History Card with Date */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-800 text-sm">Payment History (With Date)</h3>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                        Linked to Sales
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">All advance & installments sync automatically into Cashbook Sales</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setTransType('PAYMENT');
                    setTransAmount('');
                    setTransDate(new Date().toISOString().slice(0, 10));
                    setTransDesc('Payment');
                    setTransPaymentMethod('Cash');
                    navigateTo('TRANSACTION_FORM', selectedContact.id);
                  }}
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={14} /> Add Payment
                </button>
              </div>

              {/* Payments List */}
              {contactTransactions.filter(t => t.type === 'PAYMENT').length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <p className="font-medium">No payments recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Tap &ldquo;+ Add Payment&rdquo; to record an advance or payment with date.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contactTransactions.filter(t => t.type === 'PAYMENT').map(p => {
                    const parsed = parsePaymentMethod(p.description, p.paymentMethod, p.chequeStatus);
                    const pendingChq = isPendingCheque(p);
                    const isChq = parsed.method === 'Cheque' || p.paymentMethod === 'Cheque';
                    return (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setEditingTransaction(p);
                          setTransType(p.type);
                          setTransAmount(p.amount.toString());
                          setTransDate(p.date);
                          setTransPaymentMethod(parsed.method || 'Cash');
                          setTransChequeStatus(parsed.chequeStatus || p.chequeStatus || 'PENDING');
                          setTransChequeNumber(parsed.chequeNumber || p.chequeNumber || '');
                          setTransChequeDate(parsed.chequeDate || p.chequeDate || p.date);
                          setTransDesc(parsed.cleanNotes);
                          navigateTo('TRANSACTION_FORM', selectedContact.id);
                        }}
                        className={`py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 cursor-pointer transition-colors group ${
                          pendingChq ? 'bg-amber-50/50 border border-amber-200/80 my-1' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            pendingChq ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {pendingChq ? <Clock size={14} /> : '✓'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isChq ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                                  pendingChq
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                }`}>
                                  {pendingChq ? <Clock size={11} className="text-amber-700" /> : <CheckCircle2 size={11} className="text-emerald-700" />}
                                  <span>Cheque {pendingChq ? '(Pending)' : '(Passed)'}</span>
                                  {parsed.chequeNumber && <span className="font-mono">#{parsed.chequeNumber}</span>}
                                </span>
                              ) : (
                                parsed.method && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                                    parsed.method === 'Bank Transfer'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : parsed.method === 'Card'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {parsed.method === 'Bank Transfer' ? <Building2 size={11} /> : parsed.method === 'Card' ? <CreditCard size={11} /> : <Banknote size={11} />}
                                    {parsed.method}
                                  </span>
                                )
                              )}
                              <span className="font-bold text-xs text-slate-800">{parsed.cleanNotes || p.description || 'Payment'}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                                <Calendar size={10} className="text-slate-400" />
                                {formatDisplayDate(p.date)}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {pendingChq ? '⏳ Post-dated cheque • Amount not added until passed' : 'Tap to update date, payment method, or amount'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm ${pendingChq ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {pendingChq ? '⏳ ' : '+ '}LKR {p.amount.toLocaleString()}
                          </span>
                          {pendingChq && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickPassCheque(p);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm active:scale-95"
                              title="Pass Cheque"
                            >
                              <CheckCircle2 size={12} />
                              <span>Pass</span>
                            </button>
                          )}
                          <div className="p-1.5 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil size={13} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Paid Footer */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Total Paid to Date:</span>
                <span className="font-black text-emerald-700">
                  LKR {contactTransactions.filter(t => t.type === 'PAYMENT' && !isPendingCheque(t)).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Service & Repair Charges Section */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <Wrench size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Service Charges & Costs (With Date)</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Repair fees and parts cost</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setTransType('CREDIT');
                    setTransAmount('');
                    setTransDate(new Date().toISOString().slice(0, 10));
                    setTransDesc('Service Total Cost');
                    setTransPaymentMethod('Cash');
                    setTransChequeStatus('PENDING');
                    setTransChequeNumber('');
                    setTransChequeDate(new Date().toISOString().slice(0, 10));
                    navigateTo('TRANSACTION_FORM', selectedContact.id);
                  }}
                  className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={14} /> Add Charge
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {contactTransactions.filter(t => t.type === 'CREDIT').map(c => (
                  <div 
                    key={c.id}
                    onClick={() => {
                      setEditingTransaction(c);
                      setTransType(c.type);
                      setTransAmount(c.amount.toString());
                      setTransDate(c.date);
                      setTransDesc(c.description || '');
                      setTransPaymentMethod('Cash');
                      setTransChequeStatus('PENDING');
                      setTransChequeNumber('');
                      setTransChequeDate(new Date().toISOString().slice(0, 10));
                      navigateTo('TRANSACTION_FORM', selectedContact.id);
                    }}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                        🔧
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{c.description || 'Service Charge'}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" />
                            {formatDisplayDate(c.date)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tap to update date or cost</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-red-600">
                        LKR {c.amount.toLocaleString()}
                      </span>
                      <div className="p-1.5 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={13} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white">
            {selectedContact.type === 'CUSTOMER' && (
              <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <ArrowUpRight size={15} className="text-emerald-600 stroke-[2.5]" />
                  <span>Customer payments automatically sync to <strong>Cashbook Sales (+ Sale)</strong></span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Linked to Sales
                </span>
              </div>
            )}
            {selectedContact.type === 'VENDOR' && (
              <div className="px-4 py-2.5 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-rose-900 font-semibold">
                  <ArrowDownRight size={15} className="text-rose-600 stroke-[2.5]" />
                  <span>Vendor payments automatically sync to <strong>Cashbook Expenses (- Expense)</strong></span>
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Linked to Expenses
                </span>
              </div>
            )}
              {selectedContact.type === 'RENT' && (
                <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-950 font-semibold">
                    <Building size={15} className="text-amber-700" />
                    <span>Rent deposits sync to <strong>Expenses (Shop Rent)</strong> & withdrawals sync to <strong>Sales (+ Sale)</strong></span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">
                    Shop Rent
                  </span>
                </div>
              )}

            {computedWithBalance.map(t => (
              <TransactionRow 
                key={t.id} 
                transaction={t} 
                contactType={selectedContact.type}
                onPassCheque={handleQuickPassCheque}
                onClick={(tx) => { 
                  const parsed = parsePaymentMethod(tx.description, tx.paymentMethod, tx.chequeStatus);
                  setEditingTransaction(tx); 
                  setTransType(tx.type); 
                  setTransAmount(tx.amount.toString()); 
                  setTransDate(tx.date); 
                  setTransPaymentMethod(parsed.method || 'Cash');
                  setTransChequeStatus(parsed.chequeStatus || tx.chequeStatus || 'PENDING');
                  setTransChequeNumber(parsed.chequeNumber || tx.chequeNumber || '');
                  setTransChequeDate(parsed.chequeDate || tx.chequeDate || tx.date);
                  setTransDesc(parsed.cleanNotes || (parsed.method ? '' : (tx.description || ''))); 
                  navigateTo('TRANSACTION_FORM', selectedContact.id); 
                }} 
              />
            ))}
            {computedWithBalance.length === 0 && <div className="p-16 text-center text-slate-400">No transactions recorded yet</div>}
          </div>
        )}
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-slate-100 z-40 shadow-lg">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(isService ? 'Service Total Cost' : ''); setTransPaymentMethod('Cash'); setTransChequeStatus('PENDING'); setTransChequeNumber(''); setTransChequeDate(new Date().toISOString().slice(0, 10)); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(''); setTransPaymentMethod('Cash'); setTransChequeStatus('PENDING'); setTransChequeNumber(''); setTransChequeDate(new Date().toISOString().slice(0, 10)); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <div className="flex items-center gap-1.5">
               <span className="text-[10px] opacity-90 uppercase font-black">{isService ? 'RECORD PAYMENT (WITH DATE)' : labelRight}</span>
               <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.2 rounded font-extrabold uppercase">
                 {selectedContact.type === 'CUSTOMER' ? '→ Sales' : (selectedContact.type === 'VENDOR' ? '→ Expenses' : (selectedContact.type === 'RENT' ? '→ Shop Rent' : '→ Sales'))}
               </span>
             </div>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowUp size={14} /></span>
          </button>
        </div>
      </div>
    );
  };

  const renderTransactionForm = () => {
    if (!selectedContact) return null;
    const isRent = selectedContact.type === 'RENT';
    const isService = selectedContact.type === 'SERVICE';
    let title = editingTransaction 
      ? (isService ? (transType === 'PAYMENT' ? 'Update Payment with Date' : 'Update Service Charge with Date') : 'Edit Record') 
      : (isRent 
          ? (transType === 'PAYMENT' ? "Deposit Savings" : "Withdraw Savings") 
          : (isService 
              ? (transType === 'CREDIT' ? 'Add Service Charge' : 'Record Payment with Date') 
              : (transType === 'CREDIT' ? 'Items Sent' : 'Cash Received')
            )
        );
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          {editingTransaction && userCanDelete && (
            <button onClick={handleDeleteTransaction} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full active:scale-90 transition-all" title="Delete Record">
              <Trash2 size={20} />
            </button>
          )}
        </header>
        <div className="p-6 flex-1 overflow-y-auto">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <input 
            type="number" 
            value={transAmount} 
            onChange={e => setTransAmount(e.target.value)} 
            placeholder="0.00" 
            className={`w-full text-5xl font-bold mb-6 outline-none border-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} 
            autoFocus 
          />

          {transType === 'PAYMENT' && (
            <div className="mb-6 -mt-2">
              {selectedContact.type === 'CUSTOMER' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ArrowUpRight size={14} className="text-emerald-600 stroke-[2.5]" />
                  <span>Customer Payment: Automatically links to <strong>Cashbook Sales (+ Sale)</strong></span>
                </div>
              )}
              {selectedContact.type === 'VENDOR' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  <ArrowDownRight size={14} className="text-rose-600 stroke-[2.5]" />
                  <span>Vendor Payment: Automatically links to <strong>Cashbook Expenses (- Expense)</strong></span>
                </div>
              )}
              {selectedContact.type === 'RENT' && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  transType === 'CREDIT' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}>
                  <Building size={14} className={transType === 'CREDIT' ? 'text-emerald-600' : 'text-amber-700'} />
                  <span>
                    {transType === 'CREDIT' 
                      ? 'Rent Withdrawal: Automatically links to Cashbook Sales (+ Sale)' 
                      : 'Rent Deposit: Automatically links to Cashbook Expenses (Shop Rent)'}
                  </span>
                </div>
              )}
              {selectedContact.type === 'SERVICE' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  <Wrench size={14} className="text-blue-600" />
                  <span>Service Payment: Automatically links to <strong>Cashbook Sales (Repair Charges)</strong></span>
                </div>
              )}
            </div>
          )}
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center justify-between">
            <span>Payment / Transaction Date</span>
            <span className="text-slate-600 font-bold">{formatDisplayDate(transDate)}</span>
          </label>
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setTransDate(new Date().toISOString().slice(0, 10))} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                TODAY
              </button>
              <button 
                type="button"
                onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setTransDate(d.toISOString().slice(0, 10)); }} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                YESTERDAY
              </button>
              <button 
                type="button"
                onClick={() => dateInputRef.current?.showPicker()} 
                className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-white text-slate-500 border border-slate-200 flex items-center justify-center gap-1 active:bg-gray-50 transition-colors shadow-sm"
              >
                <Calendar size={12} /> CHANGE DATE
              </button>
            </div>
            <input 
              ref={dateInputRef} 
              type="date" 
              value={transDate} 
              onChange={e => setTransDate(e.target.value)} 
              className="w-full border-b py-3 font-semibold outline-none focus:border-blue-500 transition-colors" 
            />
          </div>

          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
            {isService ? (transType === 'PAYMENT' ? 'Payment Note / Reference' : 'Charge Description') : 'Notes'}
          </label>
          <textarea 
            value={transDesc} 
            onChange={e => setTransDesc(e.target.value)} 
            placeholder={isService ? (transType === 'PAYMENT' ? 'e.g. Advance Payment, Balance Payment...' : 'e.g. Screen Replacement, Battery...') : 'Add optional details...'} 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 h-20 outline-none focus:border-slate-300 transition-colors text-sm" 
          />

          {isService && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Note Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {(transType === 'PAYMENT' 
                  ? ['Advance Payment', 'Part Payment', 'Final Balance Payment', 'Cash Payment', 'Bank Transfer']
                  : ['Service Total Cost', 'Screen Replacement', 'Battery Replacement', 'Charging Port', 'Motherboard Repair']
                ).map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTransDesc(chip)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold transition-all ${
                      transDesc === chip ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type of Payment Selection (Cash, Bank Transfer, Card, Cheque) - Below Notes Section */}
          {(transType === 'PAYMENT' || transPaymentMethod === 'Cheque') && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 block flex items-center justify-between">
                <span>Type of Payment</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  transPaymentMethod === 'Bank Transfer' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : transPaymentMethod === 'Card'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : transPaymentMethod === 'Cheque'
                    ? (transChequeStatus === 'PENDING' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300')
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {transPaymentMethod === 'Cheque' && transChequeStatus === 'PENDING' ? '⏳' : '✓'} {transPaymentMethod} {transPaymentMethod === 'Cheque' ? (transChequeStatus === 'PENDING' ? '(Pending Hold)' : '(Passed)') : ''}
                </span>
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTransPaymentMethod('Cash')}
                  className={`py-3.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    transPaymentMethod === 'Cash'
                      ? 'border-emerald-600 bg-emerald-50/90 text-emerald-900 ring-2 ring-emerald-400/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    transPaymentMethod === 'Cash' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Banknote size={18} />
                  </div>
                  <span className="text-xs font-bold tracking-tight">Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransPaymentMethod('Bank Transfer')}
                  className={`py-3.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    transPaymentMethod === 'Bank Transfer'
                      ? 'border-blue-600 bg-blue-50/90 text-blue-900 ring-2 ring-blue-400/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    transPaymentMethod === 'Bank Transfer' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Building2 size={18} />
                  </div>
                  <span className="text-xs font-bold tracking-tight text-center leading-tight">Bank Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransPaymentMethod('Card')}
                  className={`py-3.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    transPaymentMethod === 'Card'
                      ? 'border-purple-600 bg-purple-50/90 text-purple-900 ring-2 ring-purple-400/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    transPaymentMethod === 'Card' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <CreditCard size={18} />
                  </div>
                  <span className="text-xs font-bold tracking-tight">Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransPaymentMethod('Cheque')}
                  className={`py-3.5 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    transPaymentMethod === 'Cheque'
                      ? 'border-amber-600 bg-amber-50/90 text-amber-900 ring-2 ring-amber-400/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    transPaymentMethod === 'Cheque' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Landmark size={18} />
                  </div>
                  <span className="text-xs font-bold tracking-tight">Cheque</span>
                </button>
              </div>

              {/* Dedicated Cheque Details & Maturity Date */}
              {transPaymentMethod === 'Cheque' && (
                <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                        <Landmark size={15} />
                      </div>
                      <h4 className="font-extrabold text-xs text-amber-900 uppercase tracking-wider">Cheque Management</h4>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                      transChequeStatus === 'PENDING'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {transChequeStatus === 'PENDING' ? '⏳ On Hold (No Balance Change)' : '✓ Passed (Updates Balance)'}
                    </span>
                  </div>

                  {/* Cheque Clearance Status Toggle */}
                  <div>
                    <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider mb-1.5 block">
                      Cheque Clearance Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTransChequeStatus('PENDING')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                          transChequeStatus === 'PENDING'
                            ? 'bg-amber-700 text-white border-amber-800 shadow-sm ring-2 ring-amber-400/40'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Clock size={14} />
                        <span>Pending (On Hold)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTransChequeStatus('PASSED')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                          transChequeStatus === 'PASSED'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/40'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>Passed / Cleared</span>
                      </button>
                    </div>

                    <div className="mt-2 bg-amber-100/70 rounded-xl p-2.5 text-[11px] text-amber-900 font-medium border border-amber-200 flex items-start gap-2">
                      <span className="text-amber-800 shrink-0 font-bold">ℹ️</span>
                      <span>
                        {transChequeStatus === 'PENDING'
                          ? 'Until this cheque is passed, the contact balance will NOT change. The amount stays securely on hold.'
                          : 'This cheque is marked as cleared and will immediately update the contact balance.'}
                      </span>
                    </div>
                  </div>

                  {/* Future Clearance Date / Maturity Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider block">
                        Cheque Date / Future Clearance Date
                      </label>
                      <span className="text-xs font-bold text-slate-800">{formatDisplayDate(transChequeDate)}</span>
                    </div>

                    {/* Quick Date Presets */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { label: 'Today', days: 0 },
                        { label: '+7 Days', days: 7 },
                        { label: '+15 Days', days: 15 },
                        { label: '+30 Days', days: 30 },
                        { label: '+60 Days', days: 60 }
                      ].map(preset => {
                        const targetDate = new Date();
                        targetDate.setDate(targetDate.getDate() + preset.days);
                        const dateStr = targetDate.toISOString().slice(0, 10);
                        const isSelected = transChequeDate === dateStr;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setTransChequeDate(dateStr)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
                              isSelected
                                ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => chequeDateInputRef.current?.showPicker()}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-white text-slate-700 border-slate-200 flex items-center gap-1 hover:bg-slate-50 shadow-xs active:scale-95"
                      >
                        <Calendar size={11} /> Change Date
                      </button>
                    </div>

                    <input
                      ref={chequeDateInputRef}
                      type="date"
                      value={transChequeDate}
                      onChange={e => setTransChequeDate(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-600 transition-colors"
                    />
                  </div>

                  {/* Cheque Number / Reference Number */}
                  <div>
                    <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider mb-1 block">
                      Cheque Number / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={transChequeNumber}
                      onChange={e => setTransChequeNumber(e.target.value)}
                      placeholder="e.g. 102948 or CHQ-001"
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-600 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-6 pb-12">
          {isService && transType === 'PAYMENT' && (
            <div className="mb-3.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-emerald-800 shadow-xs">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Auto-linked to Sales: This payment will automatically be recorded under <strong>Repair Charges</strong> in the Cashbook.</span>
            </div>
          )}
          <button 
            disabled={isSubmitting} 
            onClick={handleSaveTransaction} 
            className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 ${transType === 'CREDIT' ? 'bg-red-700' : 'bg-green-700'} active:scale-95 transition-all`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isService ? (transType === 'PAYMENT' ? 'Save Payment with Date' : 'Save Charge Record') : 'Confirm Record')}
          </button>
        </div>
      </div>
    );
  };

  const renderContactForm = () => {
    const isService = activeTab === 'SERVICE';
    const formHeading = editingContact 
      ? `Edit ${isService ? 'Service Order' : activeTab}` 
      : `New ${isService ? 'Service Order' : activeTab}`;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">{formHeading}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isService ? 'Customer Name' : 'Full Name'}</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={isService ? "Enter customer name" : "Enter Name"} className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="Enter Phone" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
          </div>
          {isService && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Model</label>
                <input 
                  value={addPhoneModel} 
                  onChange={e => setAddPhoneModel(e.target.value)} 
                  placeholder="e.g. iPhone 13 Pro, Samsung A12" 
                  className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" 
                />
              </div>

              {/* Collected Items with Device Checklist */}
              <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-200/70 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-indigo-600" />
                    <span>Collecting Items with Phone (Tick Checkbox)</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                    {addCollectedItems.length} Selected
                  </span>
                </div>

                {/* Quick select presets */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAddCollectedItems(['SIM Card', 'SIM Tray', 'Back Cover', 'Battery', 'Back Panel'])}
                    className="text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors"
                  >
                    + Standard 5 (SIM, Tray, Cover, Battery, Panel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddCollectedItems([...DEFAULT_COLLECTED_ITEMS])}
                    className="text-[10px] font-bold bg-white text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddCollectedItems([]); setAddOtherCollectedItems(''); }}
                    className="text-[10px] font-bold bg-white text-slate-500 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Device Only (Clear)
                  </button>
                </div>

                {/* Grid of Tick Mark Checkbox Items */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {DEFAULT_COLLECTED_ITEMS.map(item => {
                    const isChecked = addCollectedItems.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setAddCollectedItems(prev => prev.filter(i => i !== item));
                          } else {
                            setAddCollectedItems(prev => [...prev, item]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 active:scale-95 ${
                          isChecked
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-1 ring-emerald-500'
                            : 'bg-white text-slate-700 border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          isChecked ? 'bg-white text-emerald-700 border-white' : 'border-slate-300 bg-slate-50 text-transparent'
                        }`}>
                          <Check size={12} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-xs leading-tight truncate">{item}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Other Custom Items input */}
                <div className="pt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Other Accessories / Items (Optional)
                  </label>
                  <input
                    type="text"
                    value={addOtherCollectedItems}
                    onChange={e => setAddOtherCollectedItems(e.target.value)}
                    placeholder="e.g. Stylus pen, pouch, power adapter, earphones..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Total Cost & Order Date */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Repair Cost (LKR)</label>
                  <input 
                    type="number"
                    value={addTotalCost} 
                    onChange={e => setAddTotalCost(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-lg font-bold outline-none focus:border-blue-500 transition-colors text-red-600" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Order / Booking Date</span>
                    <span className="text-slate-700 font-bold">{formatDisplayDate(addOrderDate)}</span>
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setAddOrderDate(new Date().toISOString().slice(0, 10))} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addOrderDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      TODAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setAddOrderDate(d.toISOString().slice(0, 10)); }} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addOrderDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      YESTERDAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => orderDateInputRef.current?.showPicker()} 
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200 flex items-center justify-center gap-1 active:bg-slate-100 transition-colors shadow-sm"
                    >
                      <Calendar size={12} /> PICK DATE
                    </button>
                  </div>
                  <input 
                    ref={orderDateInputRef} 
                    type="date" 
                    value={addOrderDate} 
                    onChange={e => setAddOrderDate(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              {/* Advance Payment & Payment Date */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Advance Payment (LKR)</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Auto-links to Sales Cashbook</span>
                  </label>
                  <input 
                    type="number"
                    value={addAdvancePayment} 
                    onChange={e => setAddAdvancePayment(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-lg font-bold outline-none focus:border-emerald-500 transition-colors text-green-700" 
                  />
                </div>
                
                {/* Advance Payment Date Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Advance Payment Date</span>
                    <span className="text-emerald-950 font-bold">{formatDisplayDate(addAdvanceDate)}</span>
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setAddAdvanceDate(new Date().toISOString().slice(0, 10))} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addAdvanceDate === new Date().toISOString().slice(0, 10) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'}`}
                    >
                      TODAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setAddAdvanceDate(d.toISOString().slice(0, 10)); }} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addAdvanceDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'}`}
                    >
                      YESTERDAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => advanceDateInputRef.current?.showPicker()} 
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1 active:bg-emerald-100 transition-colors shadow-sm"
                    >
                      <Calendar size={12} /> PICK DATE
                    </button>
                  </div>
                  <input 
                    ref={advanceDateInputRef} 
                    type="date" 
                    value={addAdvanceDate} 
                    onChange={e => setAddAdvanceDate(e.target.value)} 
                    className="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 text-emerald-900" 
                  />
                </div>
              </div>

              {((parseFloat(addTotalCost) || 0) > 0 || (parseFloat(addAdvancePayment) || 0) > 0) && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center shadow-inner">
                  <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Balance Due</span>
                  <span className="font-black text-lg text-red-600">
                    LKR {Math.max(0, (parseFloat(addTotalCost) || 0) - (parseFloat(addAdvancePayment) || 0)).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Pending', 'In Progress', 'Ready', 'Delivered'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setAddServiceStatus(status)}
                      className={`py-2 px-1 text-center rounded-lg text-[11px] font-bold border transition-all ${
                        addServiceStatus === status 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeTab === 'RENT' && (<div className="flex flex-col gap-1"><label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Target (LKR)</label><input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} type="number" placeholder="30000" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" /></div>)}
          <button disabled={isSubmitting || !addName.trim()} onClick={handleSaveContact} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingContact ? 'Update ' + (isService ? 'Service Order' : 'Contact') : 'Save ' + (isService ? 'Service Order' : 'Contact'))}</button>
        </div>
      </div>
    );
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showProfileToast('Please choose an image file (PNG, JPG, WebP)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 240;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
        } else {
          if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setShopLogo(dataUrl);
          localStorage.setItem('st_shop_logo', dataUrl);
          showProfileToast('Logo uploaded and saved successfully!');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setShopLogo(null);
    localStorage.removeItem('st_shop_logo');
    showProfileToast('Store logo removed');
  };

  const handleSaveStoreProfile = async () => {
    if (!shopName.trim()) {
      showProfileToast('Store name cannot be empty', 'error');
      return;
    }
    localStorage.setItem('st_shop_name', shopName.trim());
    localStorage.setItem('st_shop_tagline', shopTagline.trim());
    localStorage.setItem('st_shop_phone', shopPhone.trim());
    localStorage.setItem('st_shop_address', shopAddress.trim());
    if (shopLogo) {
      localStorage.setItem('st_shop_logo', shopLogo);
    }

    if (authUser) {
      try {
        const payload = {
          id: authUser.id,
          full_name: userProfile?.fullName || authUser.user_metadata?.full_name || 'Shop Owner',
          shop_name: shopName.trim(),
          tagline: shopTagline.trim(),
          phone: shopPhone.trim(),
          address: shopAddress.trim(),
          logo_url: shopLogo,
          setup_completed: true,
          updated_at: new Date().toISOString()
        };
        await supabase.from('profiles').upsert(payload);
        setUserProfile(prev => prev ? { ...prev, ...payload, setupCompleted: true } : { ...payload, setupCompleted: true });
      } catch (err) {
        console.warn('Profile sync to Supabase warning:', err);
      }
    }
    showProfileToast('Store profile details saved successfully!');
  };

  const handleOpenAddUser = () => {
    if (!userCanManageUsers) {
      showProfileToast('Access Denied: Administrator rights required to add team users.', 'error');
      return;
    }
    setEditingUser(null);
    setUserForm({
      name: '',
      username: '',
      role: 'Cashier',
      phone: '',
      status: 'Active',
      canDeleteData: false,
      canEditData: true,
      canManageUsers: false
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AppUser) => {
    if (!userCanManageUsers && user.id !== currentUser.id) {
      showProfileToast('Access Denied: Administrator rights required to edit other users.', 'error');
      return;
    }
    setEditingUser(user);
    setUserForm({
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone || '',
      status: user.status,
      canDeleteData: user.permissions?.canDeleteData !== undefined ? user.permissions.canDeleteData : (user.role === 'Admin'),
      canEditData: user.permissions?.canEditData !== undefined ? user.permissions.canEditData : true,
      canManageUsers: user.permissions?.canManageUsers !== undefined ? user.permissions.canManageUsers : (user.role === 'Admin')
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userForm.name.trim()) {
      showProfileToast('Please enter the user full name', 'error');
      return;
    }
    if (!userForm.username.trim()) {
      showProfileToast('Please enter a username or email', 'error');
      return;
    }
    const cleanUsername = userForm.username.trim().toLowerCase();
    const exists = users.find(u => u.username.toLowerCase() === cleanUsername && u.id !== editingUser?.id);
    if (exists) {
      showProfileToast(`Username "${cleanUsername}" is already taken!`, 'error');
      return;
    }

    const assignedPermissions: UserPermissions = {
      canDeleteData: userForm.canDeleteData,
      canEditData: userForm.canEditData,
      canManageUsers: userForm.canManageUsers
    };

    if (editingUser) {
      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: userForm.name.trim(),
            username: cleanUsername,
            role: userForm.role,
            phone: userForm.phone.trim(),
            status: userForm.status,
            permissions: assignedPermissions
          };
        }
        return u;
      });
      saveAccountUsers(updatedUsers);
      showProfileToast(`User "${userForm.name}" updated!`);
    } else {
      const newUser: AppUser = {
        id: generateUUID(),
        name: userForm.name.trim(),
        username: cleanUsername,
        role: userForm.role,
        phone: userForm.phone.trim(),
        status: userForm.status,
        permissions: assignedPermissions,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      const updatedUsers = [...users, newUser];
      saveAccountUsers(updatedUsers);
      showProfileToast(`New staff user "${newUser.name}" added!`);
    }
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (!userCanManageUsers) {
      showProfileToast('Access Denied: Only Administrators can delete users.', 'error');
      return;
    }
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.role === 'Admin' && users.filter(u => u.role === 'Admin').length <= 1) {
      showProfileToast('Cannot delete the last Administrator account!', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${user.name}" (@${user.username})?`)) return;
    const updated = users.filter(u => u.id !== userId);
    saveAccountUsers(updated);
    if (currentUserId === userId && updated.length > 0) {
      setCurrentUserId(updated[0].id);
      localStorage.setItem('st_current_user_id', updated[0].id);
    }
    showProfileToast(`User "${user.name}" deleted`);
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        shopName,
        shopTagline,
        shopPhone,
        shopAddress,
        contacts,
        transactions,
        users: users.map(u => ({ ...u, pin: '****' }))
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shopName.replace(/[^a-z0-9]/gi, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showProfileToast('Backup exported successfully!');
    } catch (e) {
      showProfileToast('Failed to export backup', 'error');
    }
  };



  const renderUserModal = () => {
    if (!isUserModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
          <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                <p className="text-xs text-slate-400">Team member account access</p>
              </div>
            </div>
            <button 
              onClick={() => setIsUserModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveUser} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Full Name</label>
              <input 
                type="text"
                value={userForm.name}
                onChange={e => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Kasun Perera"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Username</label>
                <input 
                  type="text"
                  value={userForm.username}
                  onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="e.g. kasun"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone</label>
                <input 
                  type="text"
                  value={userForm.phone}
                  onChange={e => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 0771234567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Role & Preset</label>
              <select
                value={userForm.role}
                onChange={e => {
                  const newRole = e.target.value as UserRole;
                  setUserForm(prev => ({
                    ...prev,
                    role: newRole,
                    canDeleteData: newRole === 'Admin',
                    canEditData: true,
                    canManageUsers: newRole === 'Admin'
                  }));
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
              >
                <option value="Admin">Administrator (Full Access & Delete Rights)</option>
                <option value="Manager">Manager (Ledger, Service & Reports)</option>
                <option value="Cashier">Cashier (Payments & Receipts)</option>
                <option value="Technician">Technician (Repairs & Status)</option>
              </select>
            </div>

            {/* Custom Rights & Permissions Settings */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Shield size={14} className="text-purple-600" />
                  User Access Rights & Permissions
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">Custom Rights</span>
              </div>

              {/* Delete Data Rights Checkbox */}
              <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:border-slate-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={userForm.canDeleteData}
                  onChange={e => setUserForm(prev => ({ ...prev, canDeleteData: e.target.checked }))}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Delete Data Rights</span>
                    {userForm.canDeleteData ? (
                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">Allowed</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-bold">Blocked / No Delete</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Allow deleting customers, service orders, transactions, and payments. If unchecked, delete buttons are hidden and deletion is strictly prevented.
                  </p>
                </div>
              </label>

              {/* Edit Data Rights Checkbox */}
              <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:border-slate-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={userForm.canEditData}
                  onChange={e => setUserForm(prev => ({ ...prev, canEditData: e.target.checked }))}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Edit Data Rights</span>
                    {userForm.canEditData ? (
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">Allowed</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-bold">Read Only</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Allow modifying repair orders, cost estimates, and customer details.
                  </p>
                </div>
              </label>

              {/* Manage Users Rights Checkbox */}
              <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:border-slate-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={userForm.canManageUsers}
                  onChange={e => setUserForm(prev => ({ ...prev, canManageUsers: e.target.checked }))}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Admin User Management</span>
                    {userForm.canManageUsers ? (
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-bold">Allowed</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-bold">Standard</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Allow adding and editing team users, granting permissions, and updating store profile.
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Account Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserForm(prev => ({ ...prev, status: 'Active' }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    userForm.status === 'Active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  ● Active
                </button>
                <button
                  type="button"
                  onClick={() => setUserForm(prev => ({ ...prev, status: 'Inactive' }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    userForm.status === 'Inactive' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  ○ Inactive
                </button>
              </div>
            </div>

            <div className="pt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={16} /> {editingUser ? 'Save User' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderPasswordModal = () => {
    if (!isPasswordModalOpen) return null;
    const targetUser = users.find(u => u.id === targetOperatorId);

    const handleVerifyAndSwitch = async (e: React.FormEvent) => {
      e.preventDefault();
      setAdminPasswordError('');
      if (!adminPasswordInput) {
        setAdminPasswordError('Please enter the Administrator password.');
        return;
      }

      setIsVerifyingAdmin(true);
      try {
        // Try authenticating with Supabase using the admin email and provided password
        const adminEmail = authUser?.email || '';
        const { error } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPasswordInput
        });

        if (error) {
          setAdminPasswordError('Incorrect administrator password. Please try again.');
          setIsVerifyingAdmin(false);
          return;
        }

        // Success! Switch operator
        if (targetOperatorId) {
          setCurrentUserId(targetOperatorId);
          localStorage.setItem('st_current_user_id', targetOperatorId);
          showProfileToast(`Successfully switched active operator to ${targetUser?.name || 'Admin'}`);
        }
        setIsPasswordModalOpen(false);
        setAdminPasswordInput('');
        setTargetOperatorId(null);
      } catch (err: any) {
        setAdminPasswordError(err.message || 'Verification failed.');
      } finally {
        setIsVerifyingAdmin(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/70 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
          <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Administrator Password Required</h3>
                <p className="text-[11px] text-slate-400">Switching to: {targetUser?.name || 'Admin'}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleVerifyAndSwitch} className="p-6 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
              You are currently logged in as a staff member. Please enter the Shop Owner / Admin password to switch to <strong>{targetUser?.name}</strong>.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Admin Password</label>
              <input 
                type="password"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                autoFocus
              />
              {adminPasswordError && (
                <p className="text-xs font-bold text-rose-600 mt-1">{adminPasswordError}</p>
              )}
            </div>

            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifyingAdmin}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isVerifyingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Verify & Switch</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  const renderSqlModal = () => {
    if (!isSqlModalOpen) return null;
    const sqlScript = `-- ==============================================================================
-- SUPABASE DATABASE MIGRATION & RLS SCHEMA FOR "LEDGER BOOK"
-- Project ID: actfubmcannmqvbsmmgv
-- Project URL: https://actfubmcannmqvbsmmgv.supabase.co
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create Profiles Table (Shop Profile & First-Time Setup State)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    shop_name TEXT NOT NULL DEFAULT '',
    tagline TEXT DEFAULT 'Mobile Phone Repair & Service',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    logo_url TEXT,
    setup_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Contacts Table with Multi-Tenant user_id
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    phone TEXT,
    type TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    target_amount NUMERIC,
    start_date TEXT,
    end_date TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transactions Table with Multi-Tenant user_id
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    description TEXT,
    balance_after NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Cashbook Entries Table with Multi-Tenant user_id
CREATE TABLE IF NOT EXISTS public.cashbook_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    payment_method TEXT DEFAULT 'Cash',
    reference_no TEXT,
    contact_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_user_id ON public.cashbook_entries(user_id);

-- 6. Enable Row Level Security (RLS) on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_entries ENABLE ROW LEVEL SECURITY;

-- 7. Strict Multi-Tenant Policies (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts" ON public.contacts
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own cashbook" ON public.cashbook_entries;
CREATE POLICY "Users can manage own cashbook" ON public.cashbook_entries
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Storage Bucket for Shop Logos
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
`;

    return (
      <div className="fixed inset-0 bg-black/70 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                <Database size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base">Supabase Database Setup</h3>
                <p className="text-xs text-slate-400">Project: {SUPABASE_PROJECT_NAME} ({SUPABASE_PROJECT_ID})</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSqlModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600 flex-1">
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-700" />
                Initialize Tables in 3 Easy Steps:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800 font-medium pl-1">
                <li>Click <strong>Copy SQL Script</strong> below.</li>
                <li>In your Supabase project dashboard, open <strong>SQL Editor</strong>.</li>
                <li>Paste and click <strong>Run</strong>. Then tap <strong>Re-test Sync</strong>!</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>SQL Script (Contacts & Transactions)</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sqlScript);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 normal-case font-bold"
                >
                  <Copy size={12} /> {copiedSql ? 'Copied to Clipboard!' : 'Copy Script'}
                </button>
              </div>
              <pre className="bg-slate-900 text-emerald-300 p-3.5 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed border border-slate-800 select-all">
                {sqlScript}
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlScript);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
                showProfileToast('SQL script copied to clipboard!');
              }}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Copy size={14} /> {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}
            </button>
            <button
              onClick={async () => {
                await fetchData();
                if (dbStatus === 'connected') {
                  setIsSqlModalOpen(false);
                  showProfileToast('Connected and synced with Supabase!');
                } else if (dbStatus === 'needs_tables') {
                  showProfileToast('Tables not detected yet. Make sure you clicked Run in SQL Editor.', 'error');
                }
              }}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Re-test Sync
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    return (
      <div className="min-h-screen bg-slate-50/60 pb-28">
        {/* Toast Notification Alert */}
        {profileToast && (
          <div className="fixed top-4 right-4 z-[150] animate-in fade-in slide-in-from-top-3 duration-200">
            <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold text-white ${
              profileToast.type === 'error' ? 'bg-rose-600 border-rose-500' : 'bg-slate-900 border-slate-800'
            }`}>
              {profileToast.type === 'error' ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
              <span>{profileToast.text}</span>
            </div>
          </div>
        )}

        {/* Top Executive Workspace Header */}
        <header className="bg-slate-900 text-white border-b border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Store & Shop Brand Info */}
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  {shopLogo ? (
                    <img 
                      src={shopLogo} 
                      alt="Store Logo" 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700/80 bg-white shadow-md" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md font-black text-2xl border border-slate-700/80">
                      {shopName[0] || 'S'}
                    </div>
                  )}
                  <button 
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-md transition-transform active:scale-90"
                    title="Change Logo"
                  >
                    <Camera size={13} />
                  </button>
                </div>

                <div className="overflow-hidden">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{shopName || 'Shop Control Center'}</h1>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> Verified Store
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{shopTagline}</p>
                  
                  {/* Account Metadata Row (Zero-Pill Typography) */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="font-medium text-slate-300">{authUser?.email}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-blue-400 font-semibold flex items-center gap-1">
                      <ShieldCheck size={13} /> Active Operator: {currentUser.name} ({currentUser.role})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Switch Operator Dropdown */}
                {users.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 px-2.5">
                    <UserCheck size={14} className="text-purple-400 shrink-0" />
                    <select
                      value={currentUserId}
                      onChange={(e) => {
                        const nextUserId = e.target.value;
                        const nextUser = users.find(u => u.id === nextUserId);
                        if (nextUser) {
                          const isTargetAdmin = nextUser.role === 'Admin' || nextUser.permissions?.canManageUsers;
                          const isCurrentAdmin = currentUser.role === 'Admin' || currentUser.permissions?.canManageUsers;

                          if (!isCurrentAdmin && isTargetAdmin) {
                            setTargetOperatorId(nextUser.id);
                            setAdminPasswordInput('');
                            setAdminPasswordError('');
                            setIsPasswordModalOpen(true);
                          } else {
                            setCurrentUserId(nextUser.id);
                            localStorage.setItem('st_current_user_id', nextUser.id);
                            showProfileToast(`Active operator switched to ${nextUser.name}`);
                          }
                        }
                      }}
                      className="bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer py-1"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                          Operator: {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sign Out CTA */}
                <button
                  onClick={handleSignOut}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>

            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex gap-1.5 border-t border-slate-800/80 pt-4 mt-6 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setProfileTab('USERS')}
                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                  profileTab === 'USERS' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users size={15} /> Team & Rights Management ({users.length})
              </button>
              <button
                onClick={() => setProfileTab('STORE')}
                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                  profileTab === 'STORE' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Store size={15} /> Store Details & Logo
              </button>
              <button
                onClick={() => setProfileTab('DATA')}
                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                  profileTab === 'DATA' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database size={15} /> Cloud Sync & Backup
              </button>
            </div>
          </div>
        </header>

        {/* Hidden File Input for Logo */}
        <input 
          ref={logoInputRef} 
          type="file" 
          accept="image/*" 
          onChange={handleLogoFileChange} 
          className="hidden" 
        />

        {/* Main Content Viewport */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* TAB 1: USER MANAGEMENT & RIGHTS */}
          {profileTab === 'USERS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header Banner & Add User Button */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">User Management & Rights</h2>
                    <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-md border border-slate-200">
                      Multi-User Access
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    Add staff members to your shop, assign roles (Cashier, Manager, Technician), and customize edit and delete permissions.
                  </p>
                </div>

                {userCanManageUsers ? (
                  <button
                    onClick={handleOpenAddUser}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95"
                  >
                    <UserPlus size={16} /> Add Staff Member
                  </button>
                ) : (
                  <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200/80 px-3 py-2 rounded-xl flex items-center gap-2 font-medium">
                    <AlertCircle size={15} className="text-amber-600 shrink-0" />
                    <span>View Only Access</span>
                  </div>
                )}
              </div>

              {/* Team Statistics KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Members</span>
                  <p className="text-xl font-black text-slate-900 mt-1 font-mono">{users.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Operator</span>
                  <p className="text-sm font-bold text-blue-600 mt-1 truncate">{currentUser.name}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Administrators</span>
                  <p className="text-xl font-black text-purple-700 mt-1 font-mono">
                    {users.filter(u => u.role === 'Admin' || u.permissions?.canManageUsers).length}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Restricted Staff</span>
                  <p className="text-xl font-black text-slate-700 mt-1 font-mono">
                    {users.filter(u => !u.permissions?.canDeleteData).length}
                  </p>
                </div>
              </div>

              {/* Staff Roster Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(u => {
                  const isCurrent = u.id === currentUserId;
                  const isOwner = u.id.startsWith('owner-') || u.role === 'Admin';
                  const canDelete = u.permissions?.canDeleteData !== undefined ? u.permissions.canDeleteData : (u.role === 'Admin');
                  const canEdit = u.permissions?.canEditData !== undefined ? u.permissions.canEditData : true;

                  return (
                    <div 
                      key={u.id}
                      className={`bg-white p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between gap-4 ${
                        isCurrent ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Card Header Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-xs ${
                              u.role === 'Admin' ? 'bg-purple-600' : (u.role === 'Manager' ? 'bg-blue-600' : 'bg-slate-700')
                            }`}>
                              {u.name[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-sm">{u.name}</h3>
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                    Active Operator
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">@{u.username} {u.phone ? `• ${u.phone}` : ''}</p>
                            </div>
                          </div>

                          <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                            u.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            u.role === 'Manager' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {u.role}
                          </span>
                        </div>

                        {/* Unboxed Permissions & Rights Metadata */}
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Delete Rights:</span>
                            {canDelete ? (
                              <span className="font-bold text-rose-600 flex items-center gap-1">
                                <Trash2 size={12} /> Allowed
                              </span>
                            ) : (
                              <span className="font-bold text-slate-400 flex items-center gap-1">
                                <Lock size={12} /> Blocked / No Access
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Edit Data Rights:</span>
                            <span className={`font-bold ${canEdit ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {canEdit ? 'Allowed' : 'Read Only'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Admin User Access:</span>
                            <span className={`font-bold ${u.permissions?.canManageUsers ? 'text-purple-600' : 'text-slate-400'}`}>
                              {u.permissions?.canManageUsers ? 'Full Admin Rights' : 'Standard Staff'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                          <span className={`w-2 h-2 rounded-full ${u.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span>{u.status}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                const targetUser = u;
                                const isTargetAdmin = targetUser.role === 'Admin' || targetUser.permissions?.canManageUsers;
                                const isCurrentAdmin = currentUser.role === 'Admin' || currentUser.permissions?.canManageUsers;

                                if (!isCurrentAdmin && isTargetAdmin) {
                                  setTargetOperatorId(targetUser.id);
                                  setAdminPasswordInput('');
                                  setAdminPasswordError('');
                                  setIsPasswordModalOpen(true);
                                } else {
                                  setCurrentUserId(targetUser.id);
                                  localStorage.setItem('st_current_user_id', targetUser.id);
                                  showProfileToast(`Switched active operator to ${targetUser.name}`);
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                              Switch Operator
                            </button>
                          )}
                          {(userCanManageUsers || isCurrent) && (
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                              title="Edit User"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {userCanManageUsers && users.length > 1 && !isOwner && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Supabase Account Ownership Banner */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{userProfile?.fullName || 'Shop Owner Account'}</h4>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Primary Owner
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{authUser?.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
                >
                  <LogOut size={15} /> Sign Out of Shop Account
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: STORE DETAILS & LOGO */}
          {profileTab === 'STORE' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              
              {/* Logo Manager */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Store Branding & Logo</h3>
                  {shopLogo && (
                    <button
                      onClick={handleRemoveLogo}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200/80 text-center gap-3">
                  <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                    {shopLogo ? (
                      <img src={shopLogo} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-400 flex flex-col items-center gap-1">
                        <ImageIcon size={28} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">No Logo</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 max-w-xs">
                    Uploaded logo renders automatically on POS receipt slips, A4 invoices, and PDF statements.
                  </p>

                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Upload size={14} /> Upload Custom Logo
                  </button>
                </div>
              </div>

              {/* Store Details Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 lg:col-span-2">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900">Store & Business Details</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Update business contact details printed on customer invoices</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Store Name</label>
                    <input 
                      type="text"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      placeholder="e.g. Smart Time Service Center"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tagline / Subtitle</label>
                    <input 
                      type="text"
                      value={shopTagline}
                      onChange={e => setShopTagline(e.target.value)}
                      placeholder="e.g. Mobile Phone Repair & Service"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone Number</label>
                      <input 
                        type="text"
                        value={shopPhone}
                        onChange={e => setShopPhone(e.target.value)}
                        placeholder="e.g. +94 77 123 4567"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Store Address / Location</label>
                      <input 
                        type="text"
                        value={shopAddress}
                        onChange={e => setShopAddress(e.target.value)}
                        placeholder="e.g. No.05 Station Road, Matale"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={handleSaveStoreProfile}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <Check size={16} /> Save Store Details
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: CLOUD SYNC & BACKUP */}
          {profileTab === 'DATA' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                      <Database size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Supabase Cloud Database</h3>
                      <p className="text-xs text-slate-400">PostgreSQL cloud persistence & multi-tenant security</p>
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                    dbStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    dbStatus === 'needs_tables' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {dbStatus === 'connected' ? '● Connected & Synced' :
                     dbStatus === 'needs_tables' ? '▲ Table Setup Required' : '✕ Disconnected'}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Project Name:</span>
                    <span className="font-bold text-slate-800">{SUPABASE_PROJECT_NAME}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Project ID:</span>
                    <span className="font-mono font-bold text-slate-800">{SUPABASE_PROJECT_ID}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Backend Endpoint:</span>
                    <span className="font-mono text-slate-600 truncate max-w-[250px]">{SUPABASE_URL}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSqlModalOpen(true)}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Copy size={14} /> View SQL Migration Script
                  </button>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Download size={14} /> Export Backup (JSON)
                  </button>
                </div>
              </div>

              {/* Danger Zone: Wipe Ledger Data */}
              {userCanDelete && userCanManageUsers && (
                <div className="bg-rose-50/70 p-6 rounded-2xl border border-rose-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <ShieldAlert size={18} /> Danger Zone: Reset Database Data
                  </div>
                  <p className="text-xs text-rose-600 leading-relaxed">
                    Permanently wipes all customer transactions, ledger records, and service orders from Supabase. This action cannot be undone.
                  </p>
                  <button 
                    onClick={async () => { 
                      if (!window.confirm("RESET APP DATA? All database records will be permanently wiped.")) return; 
                      await Promise.all([
                        supabase.from('transactions').delete().neq('id', '0'), 
                        supabase.from('contacts').delete().neq('id', '0')
                      ]); 
                      window.location.reload(); 
                    }} 
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs active:scale-95 transition-all text-xs"
                  >
                    Wipe All Ledger Records
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  };

  // ==========================================
  // CASHBOOK / SALES & EXPENSES MODULE
  // ==========================================
  // Base entries filtered by Date Period, Category, and Search (EXCLUDES pending cheques)
  const baseFilteredCashbookEntries = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return cashbookEntries.filter(entry => {
      // 1. Pending cheques do NOT show in Sales & Expense Daybook until passed
      if (isPendingCashbookEntry(entry)) return false;

      // 2. Category filter
      if (cashbookCategoryFilter !== 'ALL' && entry.category !== cashbookCategoryFilter) return false;

      // 3. Search filter
      if (cashbookSearch.trim()) {
        const q = cashbookSearch.toLowerCase();
        const matchesCat = entry.category?.toLowerCase().includes(q);
        const matchesDesc = entry.description?.toLowerCase().includes(q);
        const matchesParty = entry.contactName?.toLowerCase().includes(q);
        const matchesRef = entry.referenceNo?.toLowerCase().includes(q);
        const matchesAmt = entry.amount.toString().includes(q);
        if (!matchesCat && !matchesDesc && !matchesParty && !matchesRef && !matchesAmt) return false;
      }

      // 4. Date period filter
      const entryD = normalizeToLocalMidnight(entry.date);
      if (cashbookDateFilter === 'TODAY') {
        return entry.date === todayStr;
      } else if (cashbookDateFilter === 'YESTERDAY') {
        return entry.date === yesterdayStr;
      } else if (cashbookDateFilter === 'THIS_WEEK') {
        return entryD >= weekStart;
      } else if (cashbookDateFilter === 'THIS_MONTH') {
        return entryD >= monthStart;
      } else if (cashbookDateFilter === 'CUSTOM') {
        const start = normalizeToLocalMidnight(cashbookCustomStart);
        const end = normalizeToLocalMidnight(cashbookCustomEnd);
        end.setHours(23, 59, 59, 999);
        return entryD >= start && entryD <= end;
      }
      return true;
    });
  }, [cashbookEntries, cashbookCategoryFilter, cashbookSearch, cashbookDateFilter, cashbookCustomStart, cashbookCustomEnd]);

  // Entries filtered by Type tab (All / Sales / Expenses) for list view display
  const filteredCashbookEntries = useMemo(() => {
    return baseFilteredCashbookEntries.filter(entry => {
      if (cashbookTypeFilter !== 'ALL' && entry.type !== cashbookTypeFilter) return false;
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [baseFilteredCashbookEntries, cashbookTypeFilter]);

  // Period totals (KPI cards) computed from baseFilteredCashbookEntries so switching Sales/Expenses tabs keeps total cards accurate
  const cashbookTotals = useMemo(() => {
    let totalSales = 0;
    let totalExpenses = 0;
    let cashSales = 0;
    let cashExpenses = 0;
    let bankSales = 0;
    let bankExpenses = 0;
    let chequeSales = 0;
    let chequeExpenses = 0;

    baseFilteredCashbookEntries.forEach(e => {
      if (e.type === 'SALE') {
        totalSales += e.amount;
        if (e.paymentMethod === 'Cash') cashSales += e.amount;
        else if (e.paymentMethod === 'Bank Transfer') bankSales += e.amount;
        else if (e.paymentMethod === 'Cheque') chequeSales += e.amount;
      } else {
        totalExpenses += e.amount;
        if (e.paymentMethod === 'Cash') cashExpenses += e.amount;
        else if (e.paymentMethod === 'Bank Transfer') bankExpenses += e.amount;
        else if (e.paymentMethod === 'Cheque') chequeExpenses += e.amount;
      }
    });

    const netBalance = totalSales - totalExpenses;
    return {
      totalSales,
      totalExpenses,
      netBalance,
      cashInHand: cashSales - cashExpenses,
      bankBalance: bankSales - bankExpenses,
      chequeBalance: chequeSales - chequeExpenses
    };
  }, [baseFilteredCashbookEntries]);

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    cashbookEntries.forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [cashbookEntries]);

  const groupedCashbookEntries = useMemo(() => {
    const groups: Array<{ date: string; entries: CashbookEntry[]; daySales: number; dayExpenses: number }> = [];
    const dateMap: Record<string, CashbookEntry[]> = {};
    
    filteredCashbookEntries.forEach(e => {
      if (!dateMap[e.date]) dateMap[e.date] = [];
      dateMap[e.date].push(e);
    });

    Object.keys(dateMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).forEach(date => {
      const items = dateMap[date];
      const daySales = items.filter(i => i.type === 'SALE').reduce((s, i) => s + i.amount, 0);
      const dayExpenses = items.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + i.amount, 0);
      groups.push({ date, entries: items, daySales, dayExpenses });
    });

    return groups;
  }, [filteredCashbookEntries]);

  const handleOpenCashbookModal = (type: CashbookEntryType = 'SALE', entryToEdit: CashbookEntry | null = null) => {
    if (entryToEdit) {
      if (!userCanEdit) {
        alert("Access Denied: You do not have permission to edit records.");
        return;
      }
      setEditingCashbookEntry(entryToEdit);
      setCashbookType(entryToEdit.type);
      setCashbookAmount(entryToEdit.amount.toString());
      setCashbookDate(entryToEdit.date || new Date().toISOString().slice(0, 10));
      setCashbookCategory(entryToEdit.category);
      setCashbookCustomCategory('');
      setCashbookDesc(entryToEdit.description || '');
      setCashbookPaymentMethod(entryToEdit.paymentMethod || 'Cash');
      setCashbookRefNo(entryToEdit.referenceNo || '');
      setCashbookContactName(entryToEdit.contactName || '');
    } else {
      setEditingCashbookEntry(null);
      setCashbookType(type);
      setCashbookAmount('');
      setCashbookDate(new Date().toISOString().slice(0, 10));
      setCashbookCategory(type === 'SALE' ? SALE_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
      setCashbookCustomCategory('');
      setCashbookDesc('');
      setCashbookPaymentMethod('Cash');
      setCashbookRefNo('');
      setCashbookContactName('');
    }
    setIsCashbookModalOpen(true);
  };

  const handleSaveCashbookEntry = async () => {
    const amountVal = parseFloat(cashbookAmount);
    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }
    const finalCategory = (cashbookCategory === 'Other' && cashbookCustomCategory.trim())
      ? cashbookCustomCategory.trim()
      : (cashbookCategory || 'General').trim();

    setIsSubmitting(true);
    try {
      const entryPayload: any = {
        user_id: authUser?.id,
        type: cashbookType,
        amount: amountVal,
        date: cashbookDate || new Date().toISOString().slice(0, 10),
        category: finalCategory,
        description: cashbookDesc.trim(),
        payment_method: cashbookPaymentMethod,
        reference_no: cashbookRefNo.trim(),
        contact_name: cashbookContactName.trim()
      };

      if (editingCashbookEntry) {
        try {
          let q = supabase.from('cashbook_entries').update(entryPayload).eq('id', editingCashbookEntry.id);
          if (authUser?.id) q = q.eq('user_id', authUser.id);
          await q;
        } catch (e) {
          console.warn('Supabase cashbook update fallback:', e);
        }
        const updatedEntries = cashbookEntries.map(e => e.id === editingCashbookEntry.id ? {
          ...e,
          type: cashbookType,
          amount: amountVal,
          date: entryPayload.date,
          category: finalCategory,
          description: entryPayload.description,
          paymentMethod: cashbookPaymentMethod,
          referenceNo: entryPayload.reference_no,
          contactName: entryPayload.contact_name
        } : e);
        setCashbookEntries(updatedEntries);
        try { 
          const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
          localStorage.setItem(cacheKey, JSON.stringify(updatedEntries));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(updatedEntries)); 
        } catch {}
        showProfileToast(`${cashbookType === 'SALE' ? 'Sale' : 'Expense'} updated successfully!`);
      } else {
        const newId = generateUUID();
        const newEntry: CashbookEntry = {
          id: newId,
          userId: authUser?.id,
          type: cashbookType,
          amount: amountVal,
          date: entryPayload.date,
          category: finalCategory,
          description: entryPayload.description,
          paymentMethod: cashbookPaymentMethod,
          referenceNo: entryPayload.reference_no,
          contactName: entryPayload.contact_name,
          createdAt: new Date().toISOString()
        };

        try {
          await supabase.from('cashbook_entries').insert([{ id: newId, ...entryPayload }]);
        } catch (e) {
          console.warn('Supabase cashbook insert fallback:', e);
        }
        const updatedEntries = [newEntry, ...cashbookEntries];
        setCashbookEntries(updatedEntries);
        try { 
          const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
          localStorage.setItem(cacheKey, JSON.stringify(updatedEntries));
          localStorage.setItem('st_cashbook_entries', JSON.stringify(updatedEntries)); 
        } catch {}
        showProfileToast(`New ${cashbookType === 'SALE' ? 'Sale (+)' : 'Expense (-)'} recorded!`);
      }
      setIsCashbookModalOpen(false);
      setEditingCashbookEntry(null);
    } catch (err: any) {
      alert("Error saving entry: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCashbookEntry = async (id: string) => {
    if (!userCanDelete) {
      alert("Access Denied: You do not have permission to delete data. Only authorized users can delete records.");
      return;
    }
    const entry = cashbookEntries.find(e => e.id === id);
    if (!window.confirm(`Delete this ${entry?.type === 'SALE' ? 'Sale' : 'Expense'} entry of LKR ${entry?.amount.toLocaleString()}?`)) return;
    setIsSubmitting(true);
    try {
      try {
        let q = supabase.from('cashbook_entries').delete().eq('id', id);
        if (authUser?.id) q = q.eq('user_id', authUser.id);
        await q;
      } catch (e) {
        console.warn('Supabase cashbook delete fallback:', e);
      }
      const updatedEntries = cashbookEntries.filter(e => e.id !== id);
      setCashbookEntries(updatedEntries);
      try { 
        const cacheKey = authUser?.id ? `st_cashbook_entries_${authUser.id}` : 'st_cashbook_entries';
        localStorage.setItem(cacheKey, JSON.stringify(updatedEntries));
        localStorage.setItem('st_cashbook_entries', JSON.stringify(updatedEntries)); 
      } catch {}
      showProfileToast('Entry deleted successfully');
    } catch (err: any) {
      alert("Failed to delete entry: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateCashbookPDF = () => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(shopName, 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(shopTagline, 14, 26);
      if (shopPhone || shopAddress) {
        doc.text(`${shopPhone} • ${shopAddress}`, 14, 31);
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Sales & Expense Daybook Statement', 14, 40);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period Filter: ${cashbookDateFilter} | Date: ${cashbookDateFilter === 'CUSTOM' ? `${cashbookCustomStart} to ${cashbookCustomEnd}` : 'Standard Period'} | Generated: ${timestamp}`, 14, 46);

      // Summary KPIs Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 50, 182, 22, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 50, 182, 22, 2, 2, 'D');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 128, 61);
      doc.text(`TOTAL SALES: LKR ${cashbookTotals.totalSales.toLocaleString()}`, 20, 62);

      doc.setTextColor(185, 28, 28);
      doc.text(`TOTAL EXPENSES: LKR ${cashbookTotals.totalExpenses.toLocaleString()}`, 82, 62);

      doc.setTextColor(cashbookTotals.netBalance >= 0 ? 21 : 185, cashbookTotals.netBalance >= 0 ? 128 : 28, cashbookTotals.netBalance >= 0 ? 61 : 28);
      doc.text(`NET CASH FLOW: LKR ${cashbookTotals.netBalance.toLocaleString()}`, 142, 62);

      doc.setTextColor(30, 41, 59);

      const rows = filteredCashbookEntries.map(e => [
        e.date,
        e.type === 'SALE' ? 'SALE (+)' : 'EXPENSE (-)',
        e.category,
        e.description || e.contactName || '-',
        e.paymentMethod,
        e.referenceNo || '-',
        e.type === 'SALE' ? `+ LKR ${e.amount.toLocaleString()}` : `- LKR ${e.amount.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 78,
        head: [['Date', 'Type', 'Category', 'Description / Party', 'Payment Mode', 'Ref / Cheque #', 'Amount']],
        body: rows.length > 0 ? rows : [['-', '-', 'No entries found for this period', '-', '-', '-', '0']],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
        foot: [[
          'Total Summary', 
          `${filteredCashbookEntries.filter(e => e.type === 'SALE').length} Sales | ${filteredCashbookEntries.filter(e => e.type === 'EXPENSE').length} Exp`,
          '-',
          '-',
          '-',
          'Net Balance',
          `LKR ${cashbookTotals.netBalance.toLocaleString()}`
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: {
          6: { halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.save(`${shopName.replace(/[^a-z0-9]/gi, '_')}_sales_expense_${new Date().toISOString().slice(0, 10)}.pdf`);
      showProfileToast('Sales & Expense PDF Report downloaded!');
    } catch (err) {
      console.error(err);
      alert("Failed to export PDF report");
    }
  };

  const renderCashBook = () => {
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const duePendingCheques: Array<{
      id: string;
      tx?: Transaction;
      entry?: CashbookEntry;
      amount: number;
      contactName: string;
      chequeDate: string;
      type: 'SALE' | 'EXPENSE';
    }> = [];

    // 1. Pending cheques from transactions
    transactions.forEach(t => {
      if (isPendingCheque(t)) {
        const parsed = parsePaymentMethod(t.description, t.paymentMethod, t.chequeStatus);
        const chqDate = parsed.chequeDate || t.chequeDate || t.date;
        if (chqDate <= todayDateStr) {
          const contact = contacts.find(c => c.id === t.contactId);
          const contactType = contact?.type || 'CUSTOMER';
          const type = (contactType === 'VENDOR' || contactType === 'RENT') ? 'EXPENSE' : 'SALE';
          duePendingCheques.push({
            id: t.id,
            tx: t,
            amount: t.amount,
            contactName: contact?.name || 'Party',
            chequeDate: chqDate,
            type
          });
        }
      }
    });

    // 2. Pending cheques from cashbookEntries (if any legacy entries)
    cashbookEntries.forEach(e => {
      if (isPendingCashbookEntry(e) && !duePendingCheques.some(item => item.id === e.id)) {
        const match = e.description?.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
        const chqDate = match ? match[1] : e.date;
        if (chqDate <= todayDateStr) {
          duePendingCheques.push({
            id: e.id,
            entry: e,
            amount: e.amount,
            contactName: e.contactName || 'Party',
            chequeDate: chqDate,
            type: e.type
          });
        }
      }
    });

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080d16] text-slate-800 dark:text-slate-100 flex flex-col pb-28 no-scrollbar transition-colors">
        {/* Top Header */}
        <header className="bg-white dark:bg-[#0b101d] px-4 py-3 shadow-xs dark:shadow-none border-b border-slate-200 dark:border-[#1e2a3c] sticky top-0 z-20 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigateTo('DASHBOARD')}
                className="p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1a2332] transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                  <Wallet size={18} />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-800 dark:text-white leading-tight">Sales & Expense</h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{shopName} • Daybook</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#1a2332] text-slate-600 dark:text-amber-400 border border-slate-200 dark:border-[#263448] hover:bg-slate-200 dark:hover:bg-[#222e42] transition-all shadow-xs active:scale-95 flex items-center justify-center"
                title={isDarkMode ? "Switch to Normal (Light) Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={generateCashbookPDF}
                className="p-2 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#222e42] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#263448] rounded-xl transition-all shadow-xs active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                title="Download PDF Statement"
              >
                <Download size={15} />
                <span className="hidden sm:inline">PDF Report</span>
              </button>

              <button
                onClick={() => handleOpenCashbookModal('SALE')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 text-xs font-bold"
              >
                <Plus size={15} />
                <span>Add Sale</span>
              </button>

              <button
                onClick={() => handleOpenCashbookModal('EXPENSE')}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 text-xs font-bold"
              >
                <Minus size={15} />
                <span>Add Expense</span>
              </button>
            </div>
          </div>

          {/* Quick Date Period Filter Chips */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'ALL', label: 'All Time' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setCashbookDateFilter(filter.id as any)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  cashbookDateFilter === filter.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#131b2a] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-[#1e2a3c] hover:bg-slate-200 dark:hover:bg-[#1a2332]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (if CUSTOM is selected) */}
          {cashbookDateFilter === 'CUSTOM' && (
            <div className="mt-2.5 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-800/50 rounded-2xl flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className="font-bold text-blue-900 dark:text-blue-300 uppercase text-[10px]">From:</span>
                <input
                  type="date"
                  value={cashbookCustomStart}
                  onChange={e => setCashbookCustomStart(e.target.value)}
                  className="bg-white dark:bg-[#0d131f] border border-blue-200 dark:border-blue-800/50 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none w-full"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className="font-bold text-blue-900 dark:text-blue-300 uppercase text-[10px]">To:</span>
                <input
                  type="date"
                  value={cashbookCustomEnd}
                  onChange={e => setCashbookCustomEnd(e.target.value)}
                  className="bg-white dark:bg-[#0d131f] border border-blue-200 dark:border-blue-800/50 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none w-full"
                />
              </div>
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="p-4 max-w-4xl mx-auto w-full space-y-4">
          {/* Top KPI Cards (Sales, Expense, Net) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Sales Card */}
            <div className="bg-white dark:bg-[#131b2a] rounded-2xl p-4 border border-emerald-100 dark:border-[#1e2a3c] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Sales (Cash In)</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  + LKR {cashbookTotals.totalSales.toLocaleString()}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {baseFilteredCashbookEntries.filter(e => e.type === 'SALE').length} sales recorded
                </p>
              </div>
            </div>

            {/* Total Expenses Card */}
            <div className="bg-white dark:bg-[#131b2a] rounded-2xl p-4 border border-rose-100 dark:border-[#1e2a3c] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Expenses (Cash Out)</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <TrendingDown size={16} />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  - LKR {cashbookTotals.totalExpenses.toLocaleString()}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {baseFilteredCashbookEntries.filter(e => e.type === 'EXPENSE').length} expenses recorded
                </p>
              </div>
            </div>

            {/* Net Balance / Cash In Hand */}
            <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
              cashbookTotals.netBalance >= 0 
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-500' 
                : 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-white/80 uppercase tracking-wider">Net Cash Flow (Profit)</span>
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-white">
                  {cashbookTotals.netBalance >= 0 ? '+' : ''}LKR {cashbookTotals.netBalance.toLocaleString()}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-white/85 font-semibold mt-0.5">
                  <span>Cash: LKR {cashbookTotals.cashInHand.toLocaleString()}</span>
                  <span>•</span>
                  <span>Bank: LKR {cashbookTotals.bankBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Due / Passed Cheques Maturity Alert Banner */}
          {duePendingCheques.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 via-emerald-50 to-blue-50 border-2 border-emerald-400 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Landmark size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-800">
                      Cheque Maturity Date Passed / Due ({duePendingCheques.length})
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Post-dated cheques have reached maturity date. Clear them to update the Sales or Expenses date.
                    </p>
                  </div>
                </div>
                {duePendingCheques.length > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      for (const chq of duePendingCheques) {
                        if (chq.tx) await handleQuickPassCheque(chq.tx);
                        else if (chq.entry) await handlePassChequeFromCashbook(chq.entry);
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1 shrink-0"
                  >
                    <CheckCircle2 size={13} />
                    <span>Pass All ({duePendingCheques.length})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200/70">
                {duePendingCheques.map(item => {
                  const isSale = item.type === 'SALE';
                  return (
                    <div key={item.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                            isSale ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {isSale ? 'Customer (+ Sale)' : 'Vendor (- Expense)'}
                          </span>
                          <span className="font-extrabold text-xs text-slate-800">
                            LKR {item.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                          Party: {item.contactName}
                        </p>
                        <p className="text-[10px] text-amber-800 font-bold mt-0.5 flex items-center gap-1">
                          <Clock size={10} /> Cheque Date: {formatDisplayDate(item.chequeDate)} &rarr; will update {isSale ? 'Sales' : 'Expenses'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.tx) handleQuickPassCheque(item.tx);
                          else if (item.entry) handlePassChequeFromCashbook(item.entry);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0"
                      >
                        <CheckCircle2 size={12} />
                        <span>Pass</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center flex-1 border border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all">
                <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by category, party, ref #, or notes..."
                  value={cashbookSearch}
                  onChange={e => setCashbookSearch(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full text-slate-800 placeholder:text-slate-400 font-medium"
                />
                {cashbookSearch && (
                  <button onClick={() => setCashbookSearch('')} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Filter Selector */}
              <div className="shrink-0">
                <select
                  value={cashbookCategoryFilter}
                  onChange={e => setCashbookCategoryFilter(e.target.value)}
                  className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-2 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  {existingCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => setCashbookTypeFilter('ALL')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  cashbookTypeFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Entries ({baseFilteredCashbookEntries.length})
              </button>

              <button
                onClick={() => setCashbookTypeFilter('SALE')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                  cashbookTypeFilter === 'SALE'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-emerald-700 border-slate-200 hover:bg-emerald-50'
                }`}
              >
                <ArrowUpRight size={13} />
                <span>Sales ({baseFilteredCashbookEntries.filter(e => e.type === 'SALE').length})</span>
              </button>

              <button
                onClick={() => setCashbookTypeFilter('EXPENSE')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                  cashbookTypeFilter === 'EXPENSE'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-rose-700 border-slate-200 hover:bg-rose-50'
                }`}
              >
                <ArrowDownRight size={13} />
                <span>Expenses ({baseFilteredCashbookEntries.filter(e => e.type === 'EXPENSE').length})</span>
              </button>
            </div>
          </div>

          {/* Grouped Entries List */}
          {groupedCashbookEntries.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Wallet size={32} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">No Sales or Expenses Recorded</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Start logging your daily sales, repair charges, accessories income, rent, and store expenses.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleOpenCashbookModal('SALE')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus size={15} /> Add First Sale
                </button>
                <button
                  onClick={() => handleOpenCashbookModal('EXPENSE')}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Minus size={15} /> Add First Expense
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCashbookEntries.map(group => (
                <div key={group.date} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  {/* Group Header */}
                  <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-500" />
                      <span className="font-extrabold text-xs text-slate-800">
                        {formatDisplayDate(group.date)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        ({group.entries.length} transaction{group.entries.length > 1 ? 's' : ''})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      {group.daySales > 0 && (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          + LKR {group.daySales.toLocaleString()}
                        </span>
                      )}
                      {group.dayExpenses > 0 && (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                          - LKR {group.dayExpenses.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Group Items */}
                  <div className="divide-y divide-slate-100">
                    {group.entries.map(entry => {
                      const isSale = entry.type === 'SALE';
                      const isCheque = entry.paymentMethod === 'Cheque';
                      const isPendingChequeEntry = isCheque && (
                        entry.description?.includes('[PENDING]') ||
                        entry.description?.toLowerCase().includes('pending') ||
                        (!entry.description?.includes('[PASSED]') && !entry.description?.includes('[CLEARED]'))
                      );
                      const entryDueDateMatch = entry.description?.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
                      const chequeDueDate = entryDueDateMatch ? entryDueDateMatch[1] : entry.date;
                      const isChequeMatured = isPendingChequeEntry && chequeDueDate <= todayDateStr;

                      return (
                        <div
                          key={entry.id}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors group"
                        >
                          {/* Left: Type Icon & Details */}
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                              isSale ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {isSale ? <ArrowUpRight size={20} className="stroke-[2.5]" /> : <ArrowDownRight size={20} className="stroke-[2.5]" />}
                            </div>

                            <div className="overflow-hidden">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  isSale ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                  {entry.category}
                                </span>

                                {/* Payment Method Badge */}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                                  entry.paymentMethod === 'Bank Transfer'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : entry.paymentMethod === 'Card'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : entry.paymentMethod === 'Cheque'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {entry.paymentMethod === 'Bank Transfer' ? <Building2 size={10} /> :
                                   entry.paymentMethod === 'Card' ? <CreditCard size={10} /> :
                                   entry.paymentMethod === 'Cheque' ? <Landmark size={10} /> :
                                   <Banknote size={10} />}
                                  {entry.paymentMethod}
                                </span>

                                {isPendingChequeEntry && (
                                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                                    isChequeMatured ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' : 'bg-amber-50 text-amber-900 border-amber-200'
                                  }`}>
                                    <Clock size={10} />
                                    {isChequeMatured ? `Maturity Reached (Due: ${chequeDueDate})` : `On Hold (Due: ${chequeDueDate})`}
                                  </span>
                                )}
                                {isCheque && entry.description?.includes('[PASSED]') && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 inline-flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Cleared ({formatDisplayDate(entry.date)})
                                  </span>
                                )}

                                {entry.referenceNo && (
                                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-bold ${
                                    entry.referenceNo.startsWith('SO-')
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : entry.referenceNo.startsWith('CUST-')
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : entry.referenceNo.startsWith('VEND-')
                                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                      : entry.referenceNo.startsWith('RENT-')
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'text-slate-500 bg-slate-100'
                                  }`}>
                                    {entry.referenceNo.startsWith('SO-') && <Wrench size={10} className="text-blue-600" />}
                                    {entry.referenceNo.startsWith('CUST-') && <Users size={10} className="text-emerald-600" />}
                                    {entry.referenceNo.startsWith('VEND-') && <Truck size={10} className="text-rose-600" />}
                                    {entry.referenceNo.startsWith('RENT-') && <Building size={10} className="text-amber-600" />}
                                    #{entry.referenceNo}
                                  </span>
                                )}
                              </div>

                              <p className="font-bold text-xs text-slate-900 mt-1 truncate">
                                {entry.description || entry.contactName || (isSale ? 'General Sale' : 'Store Expense')}
                              </p>

                              {entry.contactName && entry.description && (
                                <p className="text-[10px] text-slate-400 truncate">Party: {entry.contactName}</p>
                              )}
                            </div>
                          </div>

                          {/* Right: Amount & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-black text-sm sm:text-base ${
                              isSale ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {isSale ? '+ ' : '- '}LKR {entry.amount.toLocaleString()}
                            </span>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              {isPendingChequeEntry && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePassChequeFromCashbook(entry);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                                  title={`Pass Cheque and update ${isSale ? 'Sales' : 'Expenses'} date to ${formatDisplayDate(chequeDueDate)}`}
                                >
                                  <CheckCircle2 size={12} />
                                  <span className="hidden sm:inline">Pass Cheque</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenCashbookModal(entry.type, entry)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Entry"
                              >
                                <Pencil size={14} />
                              </button>

                              {userCanDelete && (
                                <button
                                  onClick={() => handleDeleteCashbookEntry(entry.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Quick Action Buttons on Mobile */}
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-10 flex justify-center">
          <div className="flex items-center gap-2 pointer-events-auto max-w-sm w-full">
            <button
              onClick={() => handleOpenCashbookModal('SALE')}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={16} />
              <span>+ Add Sale</span>
            </button>

            <button
              onClick={() => handleOpenCashbookModal('EXPENSE')}
              className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Minus size={16} />
              <span>- Add Expense</span>
            </button>
          </div>
        </div>

        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  };

  const renderCashbookModal = () => {
    if (!isCashbookModalOpen) return null;

    const categoriesList = cashbookType === 'SALE' ? SALE_CATEGORIES : EXPENSE_CATEGORIES;

    return (
      <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className={`p-4 text-white flex justify-between items-center shrink-0 ${
            cashbookType === 'SALE' ? 'bg-emerald-700' : 'bg-rose-700'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                {cashbookType === 'SALE' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              </div>
              <div>
                <h3 className="font-extrabold text-base">
                  {editingCashbookEntry ? `Edit ${cashbookType === 'SALE' ? 'Sale' : 'Expense'}` : (cashbookType === 'SALE' ? 'Record Sale (Cash In)' : 'Record Expense (Cash Out)')}
                </h3>
                <p className="text-[11px] text-white/80">Ledger Book Daybook</p>
              </div>
            </div>
            <button
              onClick={() => setIsCashbookModalOpen(false)}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Form */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Type Selector Toggle (Sale vs Expense) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setCashbookType('SALE');
                  setCashbookCategory(SALE_CATEGORIES[0]);
                }}
                className={`py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  cashbookType === 'SALE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight size={15} />
                <span>Sale (Income)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCashbookType('EXPENSE');
                  setCashbookCategory(EXPENSE_CATEGORIES[0]);
                }}
                className={`py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  cashbookType === 'EXPENSE'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight size={15} />
                <span>Expense (Spend)</span>
              </button>
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Amount (LKR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">
                  LKR
                </span>
                <input
                  type="number"
                  step="any"
                  autoFocus
                  value={cashbookAmount}
                  onChange={e => setCashbookAmount(e.target.value)}
                  placeholder="0.00"
                  className={`w-full pl-14 pr-4 py-3 bg-slate-50 border-2 rounded-2xl text-2xl font-black outline-none transition-all ${
                    cashbookType === 'SALE'
                      ? 'border-emerald-200 focus:border-emerald-600 text-emerald-700 bg-emerald-50/30'
                      : 'border-rose-200 focus:border-rose-600 text-rose-700 bg-rose-50/30'
                  }`}
                />
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Date</span>
                <span className="text-slate-800 font-bold">{formatDisplayDate(cashbookDate)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCashbookDate(new Date().toISOString().slice(0, 10))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    cashbookDate === new Date().toISOString().slice(0, 10)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setCashbookDate(d.toISOString().slice(0, 10));
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    cashbookDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => cashbookDateInputRef.current?.showPicker()}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 flex items-center justify-center gap-1 transition-all"
                >
                  <Calendar size={13} />
                  <span>Pick Date</span>
                </button>
              </div>
              <input
                ref={cashbookDateInputRef}
                type="date"
                value={cashbookDate}
                onChange={e => setCashbookDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            {/* Category Presets & Custom Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200/80">
                {categoriesList.map(cat => {
                  const isSelected = cashbookCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCashbookCategory(cat)}
                      className={`py-1 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? (cashbookType === 'SALE' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-rose-600 text-white border-rose-600 shadow-xs')
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCashbookCategory('Other')}
                  className={`py-1 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                    cashbookCategory === 'Other'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  + Custom / Other
                </button>
              </div>

              {cashbookCategory === 'Other' && (
                <div className="mt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={cashbookCustomCategory}
                    onChange={e => setCashbookCustomCategory(e.target.value)}
                    placeholder="Type custom category name..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', icon: Banknote },
                  { id: 'Bank Transfer', icon: Building2 },
                  { id: 'Card', icon: CreditCard },
                  { id: 'Cheque', icon: Landmark },
                ].map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCashbookPaymentMethod(id as PaymentMethod)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      cashbookPaymentMethod === id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="text-[10px] font-bold leading-none truncate w-full">{id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reference No / Cheque No / Bill No */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {cashbookPaymentMethod === 'Cheque' ? 'Cheque #' : 'Receipt / Ref #'}
                </label>
                <input
                  type="text"
                  value={cashbookRefNo}
                  onChange={e => setCashbookRefNo(e.target.value)}
                  placeholder="e.g. INV-1049"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Party / Person (Optional)
                </label>
                <input
                  type="text"
                  value={cashbookContactName}
                  onChange={e => setCashbookContactName(e.target.value)}
                  placeholder="e.g. Kasun / Supplier"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Description / Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Description / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={cashbookDesc}
                onChange={e => setCashbookDesc(e.target.value)}
                placeholder="Details of the sale or expense..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCashbookModalOpen(false)}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !cashbookAmount || parseFloat(cashbookAmount) <= 0}
              onClick={handleSaveCashbookEntry}
              className={`flex-1 py-3 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                cashbookType === 'SALE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  <span>{editingCashbookEntry ? 'Update Entry' : (cashbookType === 'SALE' ? 'Save Sale' : 'Save Expense')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 1. Initial Session Loading from Supabase
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-blue-500/20">
          <Store size={32} />
        </div>
        <Loader2 className="animate-spin text-blue-400 mb-3" size={32} />
        <h2 className="text-base font-bold text-white">Ledger Book</h2>
        <p className="text-xs font-semibold text-slate-400 mt-1">Checking secure session...</p>
      </div>
    );
  }

  // 2. User is not signed in
  if (!authUser) {
    return (
      <AuthScreen
        onAuthSuccess={async (user, profile) => {
          setAuthUser(user);
          if (profile) {
            setUserProfile(profile);
            setShopName(profile.shopName || '');
            setShopPhone(profile.phone || '');
            setShopAddress(profile.address || '');
            setShopTagline(profile.tagline || 'Mobile Phone Repair & Service');
            setShopLogo(profile.logoUrl || null);
          }
          setIsAuthenticated(true);
          sessionStorage.setItem('st_auth_active', 'true');
          await fetchData(user.id);
        }}
      />
    );
  }

  // 3. User is signed in, but their email is unverified
  if (!authUser.email_confirmed_at && (authUser as any).confirmed_at === null) {
    return (
      <AuthScreen
        initialMode="VERIFY_EMAIL"
        initialEmail={authUser.email || ''}
        onAuthSuccess={async (user, profile) => {
          setAuthUser(user);
          if (profile) {
            setUserProfile(profile);
            setShopName(profile.shopName || '');
            setShopPhone(profile.phone || '');
            setShopAddress(profile.address || '');
            setShopTagline(profile.tagline || 'Mobile Phone Repair & Service');
            setShopLogo(profile.logoUrl || null);
          }
          setIsAuthenticated(true);
          sessionStorage.setItem('st_auth_active', 'true');
          await fetchData(user.id);
        }}
      />
    );
  }

  // 4. User is verified, but first-time shop setup form is required
  if (!userProfile || !userProfile.setupCompleted) {
    return (
      <ShopSetupScreen
        userId={authUser.id}
        userEmail={authUser.email || ''}
        initialFullName={authUser.user_metadata?.full_name || ''}
        onSetupComplete={async (newProfile) => {
          setUserProfile(newProfile);
          setShopName(newProfile.shopName || '');
          setShopPhone(newProfile.phone || '');
          setShopAddress(newProfile.address || '');
          setShopTagline(newProfile.tagline || 'Mobile Phone Repair & Service');
          setShopLogo(newProfile.logoUrl || null);
          setIsAuthenticated(true);
          sessionStorage.setItem('st_auth_active', 'true');
          await fetchData(authUser.id);
        }}
      />
    );
  }

  let content;
  if (currentView === 'DASHBOARD') content = renderDashboard();
  else if (currentView === 'DETAIL') content = renderDetail();
  else if (currentView === 'TRANSACTION_FORM') content = renderTransactionForm();
  else if (currentView === 'CONTACT_FORM') content = renderContactForm();
  else if (currentView === 'PROFILE') content = renderProfile();
  else if (currentView === 'CASH_BOOK') content = renderCashBook();
  else content = <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-200" size={40} /></div>;

  return (
    <>
      {content}
      {renderReportModal()}
      {renderPreviewModal()}
      {renderUserModal()}
      {renderPasswordModal()}
      {renderSqlModal()}
      {renderCashbookModal()}
    </>
  );
}